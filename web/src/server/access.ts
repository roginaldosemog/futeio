import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { components } from "../generated/api-types.ts";
import { ADMIN_ID, GROUP_ID, HttpError, fields, requireAdmin, type Session } from "./context.ts";
import { config, firebase } from "./firebase.ts";
import { requestSource } from "./request-source.ts";

const COOKIE = "futeio_session";
const FORMAT = /^[A-Za-z0-9_-]{43}$/;
const ADMIN_TTL = 8 * 60 * 60;
const PLAYER_TTL = 7 * 24 * 60 * 60;
const ANONYMOUS_TTL = 30 * 60;
type StoredSession = Partial<Session> & {
  createdAt: Timestamp; expiresAt: Timestamp; authTime?: number;
  authUid?: string; credentialHash?: string; credentialVersion?: number;
  transport?: "BROWSER" | "NATIVE";
};
type SessionCredentials = Pick<StoredSession, "authUid" | "authTime" | "credentialHash" | "credentialVersion">;
type NativeSessionResponse = components["schemas"]["NativeSessionResponseDto"];
export const secretHash = (value: string) => createHash("sha256").update(value).digest("hex");
const newSecret = () => randomBytes(32).toString("base64url");

export function isNativeTransport(request: Request) {
  return request.headers.has("authorization") || request.headers.has("x-futeio-client");
}

export function requireBrowserRequest(request: Request) {
  if (isNativeTransport(request)) throw new HttpError(400, "Combinação de credenciais inválida.");
}

export function requireNativeRequest(request: Request, authenticated = false) {
  if (request.headers.has("cookie") && request.headers.has("authorization")) throw new HttpError(400, "Combinação de credenciais inválida.");
  if (request.headers.has("cookie") || request.headers.has("origin")) throw new HttpError(403, "Solicitação nativa inválida.");
  if (request.headers.get("x-futeio-client") !== "native") throw new HttpError(401, "Entre para continuar.");
  if (!authenticated && request.headers.has("authorization")) throw new HttpError(400, "Combinação de credenciais inválida.");
}

function cookieValue(request: Request) {
  const values = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${COOKIE}=`));
  const value = values.length === 1 ? values[0]!.slice(COOKIE.length + 1) : "";
  return FORMAT.test(value) ? value : undefined;
}

function cookie(value: string, maxAge: number) {
  const secure = new URL(config().origin).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

const csrf = (token: string) => createHmac("sha256", config().secret).update(`futeio:csrf:v1:${token}`).digest("base64url");

// Keys are hashed; expiry is enforced independently of the daily cleanup.
export async function rateLimit(scope: string, key: string, limit: number) {
  const { db } = firebase();
  const window = Math.floor(Date.now() / 900_000);
  const ref = db.collection("rateLimits").doc(secretHash(`${scope}:${key}:${window}`));
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const count = snapshot.exists ? Number(snapshot.get("count")) : 0;
    if (count >= limit) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
    tx.set(ref, { count: count + 1, expiresAt: Timestamp.fromMillis((window + 1) * 900_000) });
  });
}

async function stored(request: Request) {
  const native = isNativeTransport(request);
  if (native) requireNativeRequest(request, true);
  const raw = native ? /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "")?.[1] : cookieValue(request);
  if (!raw) return undefined;
  const ref = firebase().db.collection("sessions").doc(secretHash(raw));
  const snap = await ref.get();
  if (!snap.exists) return undefined;
  const data = snap.data() as StoredSession;
  if (!(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= Date.now()) return undefined;
  if ((data.transport ?? "BROWSER") !== (native ? "NATIVE" : "BROWSER")) throw new HttpError(401, "Entre para continuar.");
  return { raw, ref, data };
}

async function verifyAdministrator(authUid: string, authTime: number) {
  try {
    const user = await firebase().auth.getUser(authUid);
    const validAfter = Math.floor(Date.parse(user.tokensValidAfterTime ?? "1970-01-01") / 1000);
    if (authUid !== config().adminUid || user.disabled || user.email?.toLowerCase() !== config().adminEmail || !Number.isFinite(authTime) || validAfter > authTime) throw new HttpError(401, "Entre para continuar.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const code = (error as { code?: string }).code;
    if (["auth/user-not-found", "auth/user-disabled"].includes(code ?? "")) throw new HttpError(401, "Entre para continuar.");
    throw new HttpError(503, "Não foi possível verificar a sessão agora.");
  }
}

export async function currentSession(request: Request): Promise<Session> {
  const entry = await stored(request);
  if (!entry || entry.data.groupId !== GROUP_ID) throw new HttpError(401, "Entre para continuar.");
  const { data } = entry;
  const { db } = firebase();
  if (data.role === "ADMIN" && data.identityId === ADMIN_ID && data.authUid === config().adminUid) {
    await verifyAdministrator(data.authUid, data.authTime ?? 0);
    const member = await db.doc(`groups/${GROUP_ID}/members/${ADMIN_ID}`).get();
    return { role: "ADMIN", identityId: ADMIN_ID, groupId: GROUP_ID, email: config().adminEmail, ...(member.get("playerId") ? { playerId: String(member.get("playerId")) } : {}) };
  }
  if (data.role === "PLAYER" && data.playerId && data.identityId) {
    const [player, member] = await db.getAll(db.doc(`groups/${GROUP_ID}/players/${data.playerId}`), db.doc(`groups/${GROUP_ID}/members/${data.identityId}`));
    if (player.exists && member.exists && member.get("playerId") === data.playerId && player.get("identityId") === data.identityId && player.get("credentialHash") === data.credentialHash && player.get("credentialVersion") === data.credentialVersion && data.credentialHash) {
      return { role: "PLAYER", identityId: data.identityId, groupId: GROUP_ID, playerId: data.playerId };
    }
  }
  throw new HttpError(401, "Entre para continuar.");
}

export async function csrfResponse(request: Request) {
  requireBrowserRequest(request);
  const entry = await stored(request);
  await rateLimit("csrf", entry?.data.identityId ?? requestSource(request), 120);
  if (entry) return { body: { csrfToken: csrf(entry.raw) }, cookie: undefined };
  const token = newSecret();
  const now = Date.now();
  await firebase().db.collection("sessions").doc(secretHash(token)).create({ transport: "BROWSER", createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + ANONYMOUS_TTL * 1000) });
  return { body: { csrfToken: csrf(token) }, cookie: cookie(token, ANONYMOUS_TTL) };
}

export async function requireCsrf(request: Request) {
  requireBrowserRequest(request);
  if (request.headers.get("origin") !== config().origin) throw new HttpError(403, "Origem inválida.");
  const token = request.headers.get("x-csrf-token") ?? "";
  const entry = await stored(request);
  if (!entry || !FORMAT.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(csrf(entry.raw)))) throw new HttpError(403, "Atualize a página e tente novamente.");
}

async function replaceSession(request: Request, data: Omit<StoredSession, "createdAt" | "expiresAt">, ttl: number) {
  const { db } = firebase();
  const raw = newSecret();
  const now = Date.now();
  const previous = cookieValue(request);
  if (!previous) throw new HttpError(401, "Atualize a página e tente novamente.");
  const previousRef = db.collection("sessions").doc(secretHash(previous));
  await db.runTransaction(async (tx) => {
    const old = await tx.get(previousRef);
    const expiry = old.get("expiresAt");
    if (!old.exists || (old.get("transport") ?? "BROWSER") !== "BROWSER" || !(expiry instanceof Timestamp) || expiry.toMillis() <= Date.now()) throw new HttpError(401, "Atualize a página e tente novamente.");
    tx.create(db.collection("sessions").doc(secretHash(raw)), { ...data, transport: "BROWSER", createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + ttl * 1000) });
    tx.delete(previousRef);
  });
  return cookie(raw, ttl);
}

async function authenticateAdministrator(request: Request, input: unknown) {
  const body = fields(input, ["email", "password"]);
  if (typeof body.email !== "string" || body.email.length > 254 || typeof body.password !== "string" || !body.password || body.password.length > 256) throw new HttpError(400, "Dados inválidos.");
  const email = body.email.trim().toLowerCase();
  const source = requestSource(request);
  await rateLimit("admin-login-source", source, 20);
  await rateLimit("admin-email-source", `${source}:${email}`, 5);
  const settings = config();
  const denied = () => new HttpError(401, "E-mail ou senha inválidos.");
  // Only this UID can become administrator, even if another Auth user has the same email.
  if (email !== settings.adminEmail) throw denied();
  const endpoint = settings.mode === "emulator"
    ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
    : "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";
  let result: Response;
  try {
    result = await fetch(`${endpoint}?key=${encodeURIComponent(settings.apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: body.password, returnSecureToken: true }), signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch { throw new HttpError(503, "Não foi possível entrar agora."); }
  if (!result.ok) throw denied();
  const payload = await result.json() as { idToken?: string };
  if (!payload.idToken) throw denied();
  const { auth } = firebase();
  let decoded;
  try { decoded = await auth.verifyIdToken(payload.idToken, true); } catch { throw denied(); }
  if (decoded.uid !== settings.adminUid || decoded.email?.toLowerCase() !== email) throw denied();
  return decoded;
}

export async function loginAdministrator(request: Request, input: unknown) {
  requireBrowserRequest(request);
  return finishAdministratorLogin(request, await authenticateAdministrator(request, input));
}

async function finishAdministratorLogin(request: Request, decoded: DecodedIdToken) {
  const settings = config();
  if (decoded.uid !== settings.adminUid || decoded.email?.toLowerCase() !== settings.adminEmail) throw new HttpError(401, "Conta não autorizada.");
  const { db } = firebase();
  await db.doc(`groups/${GROUP_ID}/members/${ADMIN_ID}`).set({ identityId: ADMIN_ID, role: "ADMIN" }, { merge: true });
  const setCookie = await replaceSession(request, { role: "ADMIN", identityId: ADMIN_ID, groupId: GROUP_ID, authUid: decoded.uid, authTime: decoded.auth_time }, ADMIN_TTL);
  return { body: { role: "ADMIN", identityId: ADMIN_ID, groupId: GROUP_ID, email: settings.adminEmail }, cookie: setCookie };
}

export async function loginAdministratorWithGoogle(request: Request, input: unknown) {
  requireBrowserRequest(request);
  const body = fields(input, ["idToken"]);
  if (typeof body.idToken !== "string" || !body.idToken || body.idToken.length > 16_384) throw new HttpError(400, "Dados inválidos.");
  const source = requestSource(request);
  await rateLimit("admin-login-source", source, 20);
  let decoded: DecodedIdToken;
  try { decoded = await firebase().auth.verifyIdToken(body.idToken, true); }
  catch { throw new HttpError(401, "Conta não autorizada."); }
  const now = Math.floor(Date.now() / 1000);
  if (decoded.firebase?.sign_in_provider !== "google.com" || !decoded.email_verified || !Number.isFinite(decoded.auth_time) || decoded.auth_time < now - 300 || decoded.auth_time > now + 60) {
    throw new HttpError(401, "Entre novamente com Google.");
  }
  await rateLimit("admin-email-source", `${source}:${decoded.email?.toLowerCase() ?? "unknown"}`, 5);
  return finishAdministratorLogin(request, decoded);
}

async function redeemCredential(request: Request, input: unknown, transport: "BROWSER" | "NATIVE") {
  const body = fields(input, ["token"]);
  if (typeof body.token !== "string" || !FORMAT.test(body.token)) throw new HttpError(400, "Link inválido.");
  await rateLimit("player-redeem", requestSource(request), 60);
  const { db } = firebase();
  const hash = secretHash(body.token);
  const raw = newSecret();
  const now = Date.now();
  const previous = transport === "BROWSER" ? cookieValue(request) : undefined;
  if (previous) await stored(request);
  const session = await db.runTransaction(async (tx) => {
    const credential = await tx.get(db.collection("playerCredentials").doc(hash));
    const groupId = credential.get("groupId");
    const playerId = credential.get("playerId") as string | undefined;
    if (!credential.exists || groupId !== GROUP_ID || !playerId) throw new HttpError(401, "Link indisponível.");
    const player = await tx.get(db.doc(`groups/${GROUP_ID}/players/${playerId}`));
    if (!player.exists || player.get("credentialHash") !== hash || player.get("credentialVersion") !== credential.get("version") || player.get("identityId") !== credential.get("identityId")) throw new HttpError(401, "Link indisponível.");
    const result: Session = { role: "PLAYER", identityId: String(player.get("identityId")), groupId: GROUP_ID, playerId };
    tx.create(db.collection("sessions").doc(secretHash(raw)), { ...result, transport, credentialHash: hash, credentialVersion: credential.get("version"), createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + PLAYER_TTL * 1000) });
    if (previous) tx.delete(db.collection("sessions").doc(secretHash(previous)));
    return result;
  });
  return { session, raw, expiresAt: new Date(now + PLAYER_TTL * 1000).toISOString() };
}

export async function redeemPlayer(request: Request, input: unknown) {
  requireBrowserRequest(request);
  const { session, raw } = await redeemCredential(request, input, "BROWSER");
  return { body: session, cookie: cookie(raw, PLAYER_TTL) };
}

export async function logout(request: Request) {
  if (isNativeTransport(request)) {
    requireNativeRequest(request, true);
    await currentSession(request);
    const entry = await stored(request);
    if (entry) await entry.ref.delete();
    return { body: { message: "Sessão encerrada." }, cookie: undefined };
  }
  requireBrowserRequest(request);
  const entry = await stored(request);
  if (entry) await entry.ref.delete();
  return { body: { message: "Sessão encerrada." }, cookie: cookie("", 0) };
}

async function createNativeSession(session: Session, credentials: SessionCredentials, ttl: number): Promise<NativeSessionResponse> {
  const token = newSecret();
  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + ttl * 1000);
  await firebase().db.collection("sessions").doc(secretHash(token)).create({ ...session, ...credentials, transport: "NATIVE", createdAt: Timestamp.fromMillis(now), expiresAt });
  return { token, expiresAt: expiresAt.toDate().toISOString(), session };
}

export async function loginAdministratorNative(request: Request, input: unknown) {
  requireNativeRequest(request);
  const decoded = await authenticateAdministrator(request, input);
  const settings = config();
  await firebase().db.doc(`groups/${GROUP_ID}/members/${ADMIN_ID}`).set({ identityId: ADMIN_ID, role: "ADMIN" }, { merge: true });
  const session: Session = { role: "ADMIN", identityId: ADMIN_ID, groupId: GROUP_ID, email: settings.adminEmail };
  return { body: await createNativeSession(session, { authUid: decoded.uid, authTime: decoded.auth_time }, ADMIN_TTL), cookie: undefined };
}

export async function redeemPlayerNative(request: Request, input: unknown) {
  requireNativeRequest(request);
  const { session, raw, expiresAt } = await redeemCredential(request, input, "NATIVE");
  return { body: { token: raw, expiresAt, session } satisfies NativeSessionResponse, cookie: undefined };
}

type NativeGrant = { codeChallenge: string; state: string; groupId: string; identityId: string; authUid: string; authTime: number; createdAt: Timestamp; expiresAt: Timestamp };
const GRANT_TTL = 120_000;
function equalSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authorizeNativeAdministrator(request: Request, input: unknown) {
  requireBrowserRequest(request);
  await requireCsrf(request);
  const session = await currentSession(request);
  requireAdmin(session);
  const body = fields(input, ["codeChallenge", "state"]);
  if (typeof body.codeChallenge !== "string" || !FORMAT.test(body.codeChallenge) || typeof body.state !== "string" || !FORMAT.test(body.state)) throw new HttpError(400, "Dados inválidos.");
  await rateLimit("native-authorize", session.identityId, 10);
  const entry = await stored(request);
  if (!entry?.data.authUid || !Number.isFinite(entry.data.authTime)) throw new HttpError(401, "Entre para continuar.");
  const code = newSecret();
  const now = Date.now();
  const grant: NativeGrant = { codeChallenge: body.codeChallenge, state: body.state, groupId: GROUP_ID, identityId: ADMIN_ID, authUid: entry.data.authUid, authTime: entry.data.authTime!, createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + GRANT_TTL) };
  await firebase().db.collection("nativeLoginGrants").doc(secretHash(code)).create(grant);
  const url = new URL("futeio://auth/callback");
  url.searchParams.set("code", code);
  url.searchParams.set("state", body.state);
  return { body: { redirectUrl: url.toString() }, cookie: undefined };
}

export async function exchangeNativeAdministrator(request: Request, input: unknown) {
  requireNativeRequest(request);
  const body = fields(input, ["code", "codeVerifier", "state"]);
  if (typeof body.code !== "string" || !FORMAT.test(body.code) || typeof body.codeVerifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.codeVerifier) || typeof body.state !== "string" || !FORMAT.test(body.state)) throw new HttpError(400, "Dados inválidos.");
  await rateLimit("admin-login-source", requestSource(request), 20);
  const { db } = firebase();
  const reference = db.collection("nativeLoginGrants").doc(secretHash(body.code));
  const challenge = createHash("sha256").update(body.codeVerifier).digest("base64url");
  const matches = (grant: NativeGrant | undefined) => grant && grant.groupId === GROUP_ID && grant.identityId === ADMIN_ID && grant.authUid === config().adminUid && Number.isFinite(grant.authTime) && grant.expiresAt instanceof Timestamp && grant.expiresAt.toMillis() > Date.now() && typeof grant.codeChallenge === "string" && typeof grant.state === "string" && equalSecret(grant.codeChallenge, challenge) && equalSecret(grant.state, body.state as string);
  const preview = (await reference.get()).data() as NativeGrant | undefined;
  if (!matches(preview)) throw new HttpError(401, "Autorização indisponível. Entre novamente.");
  await verifyAdministrator(preview!.authUid, preview!.authTime);
  await rateLimit("admin-email-source", `${requestSource(request)}:${config().adminEmail}`, 5);
  const token = newSecret();
  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + ADMIN_TTL * 1000);
  const session: Session = { role: "ADMIN", identityId: ADMIN_ID, groupId: GROUP_ID, email: config().adminEmail };
  await db.runTransaction(async tx => {
    const grant = (await tx.get(reference)).data() as NativeGrant | undefined;
    if (!matches(grant) || grant!.authUid !== preview!.authUid || grant!.authTime !== preview!.authTime) throw new HttpError(401, "Autorização indisponível. Entre novamente.");
    tx.create(db.collection("sessions").doc(secretHash(token)), { ...session, transport: "NATIVE", authUid: grant!.authUid, authTime: grant!.authTime, createdAt: Timestamp.fromMillis(now), expiresAt });
    tx.delete(reference);
  });
  return { body: { token, expiresAt: expiresAt.toDate().toISOString(), session } satisfies NativeSessionResponse, cookie: undefined };
}
