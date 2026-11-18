import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { ADMIN_ID, GROUP_ID, HttpError, fields, type Session } from "./context.ts";
import { config, firebase } from "./firebase.ts";

const COOKIE = "futeio_session";
const FORMAT = /^[A-Za-z0-9_-]{43}$/;
const ADMIN_TTL = 8 * 60 * 60;
const PLAYER_TTL = 7 * 24 * 60 * 60;
const ANONYMOUS_TTL = 30 * 60;
type StoredSession = Partial<Session> & {
  createdAt: Timestamp; expiresAt: Timestamp; authTime?: number;
  authUid?: string; credentialHash?: string; credentialVersion?: number;
};
export const secretHash = (value: string) => createHash("sha256").update(value).digest("hex");
const newSecret = () => randomBytes(32).toString("base64url");

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

// Shared quotas deliberately do not trust user-supplied forwarding headers.
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
  const raw = cookieValue(request);
  if (!raw) return undefined;
  const ref = firebase().db.collection("sessions").doc(secretHash(raw));
  const snap = await ref.get();
  if (!snap.exists) return undefined;
  const data = snap.data() as StoredSession;
  if (!(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= Date.now()) return undefined;
  return { raw, ref, data };
}

export async function currentSession(request: Request): Promise<Session> {
  const entry = await stored(request);
  if (!entry || entry.data.groupId !== GROUP_ID) throw new HttpError(401, "Entre para continuar.");
  const { data } = entry;
  const { db, auth } = firebase();
  if (data.role === "ADMIN" && data.identityId === ADMIN_ID && data.authUid === config().adminUid) {
    try {
      const user = await auth.getUser(data.authUid);
      const validAfter = Math.floor(Date.parse(user.tokensValidAfterTime ?? "1970-01-01") / 1000);
      if (user.disabled || user.email?.toLowerCase() !== config().adminEmail || validAfter > (data.authTime ?? 0)) throw new HttpError(401, "Entre para continuar.");
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const code = (error as { code?: string }).code;
      if (["auth/user-not-found", "auth/user-disabled"].includes(code ?? "")) throw new HttpError(401, "Entre para continuar.");
      throw new HttpError(503, "Não foi possível verificar a sessão agora.");
    }
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
  const entry = await stored(request);
  await rateLimit("csrf", entry?.data.identityId ?? "shared", 120);
  if (entry) return { body: { csrfToken: csrf(entry.raw) }, cookie: undefined };
  const token = newSecret();
  const now = Date.now();
  await firebase().db.collection("sessions").doc(secretHash(token)).create({ createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + ANONYMOUS_TTL * 1000) });
  return { body: { csrfToken: csrf(token) }, cookie: cookie(token, ANONYMOUS_TTL) };
}

export async function requireCsrf(request: Request) {
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
    if (!old.exists || !(expiry instanceof Timestamp) || expiry.toMillis() <= Date.now()) throw new HttpError(401, "Atualize a página e tente novamente.");
    tx.create(db.collection("sessions").doc(secretHash(raw)), { ...data, createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + ttl * 1000) });
    tx.delete(previousRef);
  });
  return cookie(raw, ttl);
}

export async function loginAdministrator(request: Request, input: unknown) {
  const body = fields(input, ["email", "password"]);
  if (typeof body.email !== "string" || body.email.length > 254 || typeof body.password !== "string" || !body.password || body.password.length > 256) throw new HttpError(400, "Dados inválidos.");
  const email = body.email.trim().toLowerCase();
  await rateLimit("admin-login", "shared", 10);
  await rateLimit("admin-email", email, 5);
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
  return finishAdministratorLogin(request, decoded);
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
  const body = fields(input, ["idToken"]);
  if (typeof body.idToken !== "string" || !body.idToken || body.idToken.length > 16_384) throw new HttpError(400, "Dados inválidos.");
  await rateLimit("admin-login", "shared", 10);
  let decoded: DecodedIdToken;
  try { decoded = await firebase().auth.verifyIdToken(body.idToken, true); }
  catch { throw new HttpError(401, "Conta não autorizada."); }
  const now = Math.floor(Date.now() / 1000);
  if (decoded.firebase?.sign_in_provider !== "google.com" || !decoded.email_verified || !Number.isFinite(decoded.auth_time) || decoded.auth_time < now - 300 || decoded.auth_time > now + 60) {
    throw new HttpError(401, "Entre novamente com Google.");
  }
  await rateLimit("admin-email", decoded.email?.toLowerCase() ?? "unknown", 5);
  return finishAdministratorLogin(request, decoded);
}

export async function redeemPlayer(request: Request, input: unknown) {
  const body = fields(input, ["token"]);
  if (typeof body.token !== "string" || !FORMAT.test(body.token)) throw new HttpError(400, "Link inválido.");
  await rateLimit("player-redeem", "shared", 60);
  const { db } = firebase();
  const hash = secretHash(body.token);
  const raw = newSecret();
  const now = Date.now();
  const previous = cookieValue(request);
  const session = await db.runTransaction(async (tx) => {
    const credential = await tx.get(db.collection("playerCredentials").doc(hash));
    const groupId = credential.get("groupId");
    const playerId = credential.get("playerId") as string | undefined;
    if (!credential.exists || groupId !== GROUP_ID || !playerId) throw new HttpError(401, "Link indisponível.");
    const player = await tx.get(db.doc(`groups/${GROUP_ID}/players/${playerId}`));
    if (!player.exists || player.get("credentialHash") !== hash || player.get("credentialVersion") !== credential.get("version") || player.get("identityId") !== credential.get("identityId")) throw new HttpError(401, "Link indisponível.");
    const result: Session = { role: "PLAYER", identityId: String(player.get("identityId")), groupId: GROUP_ID, playerId };
    tx.create(db.collection("sessions").doc(secretHash(raw)), { ...result, credentialHash: hash, credentialVersion: credential.get("version"), createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + PLAYER_TTL * 1000) });
    if (previous) tx.delete(db.collection("sessions").doc(secretHash(previous)));
    return result;
  });
  return { body: session, cookie: cookie(raw, PLAYER_TTL) };
}

export async function logout(request: Request) {
  const raw = cookieValue(request);
  if (raw) await firebase().db.collection("sessions").doc(secretHash(raw)).delete();
  return { body: { message: "Sessão encerrada." }, cookie: cookie("", 0) };
}
