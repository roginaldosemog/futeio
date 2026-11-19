import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp } from "firebase-admin/firestore";
import { config, firebase, emulatorBucket } from "../src/server/firebase.ts";
import { authorizedMaintenance, removeExpiredRecords } from "../src/server/maintenance.ts";
import { requestSource } from "../src/server/request-source.ts";
import { ADMIN_ID, GROUP_ID, HttpError, type Session } from "../src/server/context.ts";
import { csrfResponse, currentSession, loginAdministrator, loginAdministratorWithGoogle, logout, redeemPlayer, requireCsrf, rateLimit, secretHash } from "../src/server/access.ts";
import * as players from "../src/server/players.ts";
import * as draws from "../src/server/draws.ts";
import { savePhoto, readPhoto, deletePhoto } from "../src/server/photos.ts";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_GOOGLE_SUBJECT } from "./admin-fixture.mjs";

const origin = process.env.APP_ORIGIN!;
const admin: Session = { role: "ADMIN", identityId: ADMIN_ID, groupId: GROUP_ID, email: TEST_ADMIN_EMAIL };
const isStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;
const request = (cookie?: string, csrf?: string, requestOrigin = origin) => new Request(`${origin}/api/v1/auth/me`, { headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie.split(";")[0]! } : {}), ...(csrf ? { "x-csrf-token": csrf } : {}) } });
async function anonymous() {
  const response = await csrfResponse(request());
  return { cookie: response.cookie!, csrf: response.body.csrfToken };
}
function fromSource(ip: string, cookie?: string, extra: Record<string, string> = {}) {
  return new Request(`${origin}/api/v1/auth/me`, { headers: { Origin: origin, "x-vercel-forwarded-for": ip, ...(cookie ? { Cookie: cookie.split(";")[0]! } : {}), ...extra } });
}
async function member(name = "Jogador sintético", rating = 7) {
  const created = await players.createPlayer(admin, { name, initialRating: rating });
  const token = new URLSearchParams(new URL(created.accessUrl).hash.slice(1)).get("token")!;
  const result = await redeemPlayer(request(), { token });
  return { ...created, token, cookie: result.cookie, session: result.body };
}

// The official Auth emulator accepts synthetic IdP assertions, never real Google tokens.
async function googleToken(subject = TEST_GOOGLE_SUBJECT, email = TEST_ADMIN_EMAIL) {
  assert.equal(config().mode, "emulator");
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-test-key`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postBody: new URLSearchParams({ providerId: "google.com", id_token: JSON.stringify({ sub: subject, email, email_verified: true }) }).toString(), requestUri: origin, returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).idToken as string;
}

before(async () => {
  assert.equal(config().projectId, "demo-futeio-test");
  await firebase().db.recursiveDelete(firebase().db.doc(`groups/${GROUP_ID}`));
});
beforeEach(async () => {
  await firebase().db.recursiveDelete(firebase().db.collection("rateLimits"));
});
after(async () => { await Promise.all(getApps().map(deleteApp)); });

test("request sources require the platform boundary, canonicalize IPv6 and ignore spoofable headers", () => {
  const previous = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    assert.equal(requestSource(fromSource("198.51.100.10")), requestSource(fromSource("198.51.100.11")));
    process.env.VERCEL = "1";
    const source = requestSource(fromSource("198.51.100.10"));
    assert.notEqual(source, requestSource(fromSource("198.51.100.11")));
    assert.equal(source, requestSource(fromSource("198.51.100.10", "futeio_session=untrusted", { "x-forwarded-for": "203.0.113.2", "x-real-ip": "203.0.113.3", "user-agent": "different" })));
    assert.equal(requestSource(fromSource("2001:db8::1")), requestSource(fromSource("2001:0db8:0000:0000:0000:0000:0000:0001")));
    for (const value of ["", "unknown", "198.51.100.10, 198.51.100.11", "198.51.100.10:80"]) assert.throws(() => requestSource(fromSource(value)), isStatus(503));
    assert.throws(() => requestSource(new Request(origin, { headers: { "x-forwarded-for": "198.51.100.10" } })), isStatus(503));
    assert.match(source, /^[a-f0-9]{64}$/);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test("password failures cannot block another source or be bypassed by changing cookies", async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    const sourceA = "198.51.100.10";
    const sourceB = "198.51.100.11";
    for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(loginAdministrator(fromSource(sourceA), { email: TEST_ADMIN_EMAIL, password: "synthetic-wrong" }), isStatus(401));
    const initialA = await csrfResponse(fromSource(sourceA));
    await assert.rejects(loginAdministrator(fromSource(sourceA, initialA.cookie, { "x-forwarded-for": sourceB }), { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }), isStatus(429));
    const initialB = await csrfResponse(fromSource(sourceB));
    const signedIn = await loginAdministrator(fromSource(sourceB, initialB.cookie), { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    assert.equal((await currentSession(request(signedIn.cookie))).role, "ADMIN");
    const records = await firebase().db.collection("rateLimits").get();
    const serialized = JSON.stringify(records.docs.map(doc => ({ id: doc.id, data: doc.data() })));
    assert.equal(serialized.includes(sourceA), false);
    assert.equal(serialized.includes(TEST_ADMIN_EMAIL), false);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test("production does not trust forwarding headers outside the configured platform", () => {
  const keys = ["VERCEL", "FUTEIO_FIREBASE_MODE", "FIREBASE_PROJECT_ID", "APP_ORIGIN", "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST"];
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.FUTEIO_FIREBASE_MODE = "production";
    process.env.FIREBASE_PROJECT_ID = "synthetic-production";
    process.env.APP_ORIGIN = "https://synthetic.example";
    assert.throws(() => requestSource(new Request("https://synthetic.example", { headers: { "x-vercel-forwarded-for": "198.51.100.10", "x-forwarded-for": "198.51.100.10", vercel: "1" } })), isStatus(503));
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("one source has one login quota across emails and Google while another can authenticate", async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    const sourceA = "198.51.100.20";
    const sourceB = "198.51.100.21";
    for (let attempt = 0; attempt < 10; attempt++) {
      await assert.rejects(loginAdministrator(fromSource(sourceA), { email: `unapproved-${attempt}@example.test`, password: "synthetic-wrong" }), isStatus(401));
      await assert.rejects(loginAdministratorWithGoogle(fromSource(sourceA), { idToken: "synthetic-invalid-token" }), isStatus(401));
    }
    await assert.rejects(loginAdministratorWithGoogle(fromSource(sourceA), { idToken: "synthetic-invalid-token" }), isStatus(429));
    const initialB = await csrfResponse(fromSource(sourceB));
    const signedIn = await loginAdministratorWithGoogle(fromSource(sourceB, initialB.cookie), { idToken: await googleToken() });
    assert.equal((await currentSession(request(signedIn.cookie))).role, "ADMIN");
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test("exhausting anonymous CSRF and link quotas cannot block another source", async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    const sourceA = fromSource("198.51.100.30");
    const sourceB = fromSource("198.51.100.31");
    const window = Math.floor(Date.now() / 900_000);
    const { db } = firebase();
    const batch = db.batch();
    // Seed exhausted buckets, including the next window so a clock boundary
    // cannot make this scenario flaky. Counter increments have separate coverage.
    for (const [scope, count] of [["csrf", 120], ["player-redeem", 60]] as const) {
      for (const bucket of [window, window + 1]) batch.set(db.collection("rateLimits").doc(secretHash(`${scope}:${requestSource(sourceA)}:${bucket}`)), { count, expiresAt: Timestamp.fromMillis((bucket + 1) * 900_000) });
    }
    await batch.commit();
    await assert.rejects(csrfResponse(sourceA), isStatus(429));
    const otherCsrf = await csrfResponse(sourceB);
    assert.ok(otherCsrf.body.csrfToken);
    const created = await players.createPlayer(admin, { name: "Link entre origens", initialRating: 5 });
    const token = new URLSearchParams(new URL(created.accessUrl).hash.slice(1)).get("token")!;
    await assert.rejects(redeemPlayer(sourceA, { token }), isStatus(429));
    const redeemed = await redeemPlayer(fromSource("198.51.100.31", otherCsrf.cookie), { token });
    assert.equal(redeemed.body.role, "PLAYER");
    assert.equal((await currentSession(request(redeemed.cookie))).playerId, created.player.id);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test("daily cleanup requires its own secret and removes only expired records", async () => {
  const old = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "synthetic-maintenance-secret-only-for-tests-0000";
  try {
    assert.equal(authorizedMaintenance(request()), false);
    assert.equal(authorizedMaintenance(new Request(origin, { headers: { authorization: "Bearer wrong" } })), false);
    assert.equal(authorizedMaintenance(new Request(origin, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })), true);
    const { db } = firebase();
    for (const name of ["sessions", "rateLimits"]) {
      await db.collection(name).doc("cleanup-expired").set({ expiresAt: Timestamp.fromMillis(Date.now() - 60_000) });
      await db.collection(name).doc("cleanup-active").set({ expiresAt: Timestamp.fromMillis(Date.now() + 60_000) });
    }
    assert.ok((await removeExpiredRecords()).deleted >= 2);
    for (const name of ["sessions", "rateLimits"]) {
      assert.equal((await db.collection(name).doc("cleanup-expired").get()).exists, false);
      assert.equal((await db.collection(name).doc("cleanup-active").get()).exists, true);
      await db.collection(name).doc("cleanup-active").delete();
    }
  } finally {
    if (old === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = old;
  }
});

test("production photo adapter uses authenticated private Blob and rejects arbitrary URLs", async () => {
  const keys = ["FUTEIO_FIREBASE_MODE", "FIREBASE_PROJECT_ID", "APP_ORIGIN", "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "BLOB_READ_WRITE_TOKEN", "VERCEL_BLOB_RETRIES"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  const path = `groups/${GROUP_ID}/players/00000000-0000-4000-8000-000000000010/00000000-0000-4000-8000-000000000020.jpg`;
  const calls: { url: URL; method: string; headers: Headers }[] = [];
  // Blob uses its own Undici transport. Disable networking for the whole adapter test.
  const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } = createRequire(import.meta.resolve("@vercel/blob"))("undici");
  const dispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  const api = agent.get("https://vercel.com");
  for (const method of ["PUT", "POST"]) api.intercept({ path: /.*/, method }).reply(200, (options: { path: string; headers: Record<string, string> }) => {
    calls.push({ url: new URL(options.path, "https://vercel.com"), method, headers: new Headers(options.headers) });
    return { url: `https://syntheticstore.private.blob.vercel-storage.com/${path}`, pathname: path, contentType: "image/jpeg", contentDisposition: "inline", etag: "synthetic" };
  });
  setGlobalDispatcher(agent);
  agent.get("https://syntheticstore.private.blob.vercel-storage.com").intercept({ path: /.*/, method: "GET" }).reply(200, (options: { path: string; headers: Record<string, string> }) => {
    calls.push({ url: new URL(options.path, "https://syntheticstore.private.blob.vercel-storage.com"), method: "GET", headers: new Headers(options.headers) });
    return Buffer.from([0xff, 0xd8]);
  }, { headers: { "content-type": "image/jpeg" } });
  try {
    process.env.FUTEIO_FIREBASE_MODE = "production";
    process.env.FIREBASE_PROJECT_ID = "synthetic-production";
    process.env.APP_ORIGIN = "https://synthetic.example";
    for (const key of keys.filter((key) => key.endsWith("EMULATOR_HOST"))) delete process.env[key];
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_syntheticstore_syntheticsecret";
    process.env.VERCEL_BLOB_RETRIES = "0";
    await savePhoto(path, Buffer.from([0xff, 0xd8]));
    assert.deepEqual(await readPhoto(path), Buffer.from([0xff, 0xd8]));
    await deletePhoto(path);
    assert.equal(calls.length, 3);
    assert.equal(calls[0]!.headers.get("x-vercel-blob-access"), "private");
    assert.equal(calls[0]!.headers.get("x-allow-overwrite"), "0");
    assert.equal(calls[1]!.url.hostname, "syntheticstore.private.blob.vercel-storage.com");
    assert.equal(calls[1]!.url.searchParams.get("cache"), "0");
    for (const call of calls) assert.equal(call.headers.get("authorization"), `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`);
    await assert.rejects(readPhoto("https://attacker.example/photo.jpg"), /Invalid private photo path/);
    assert.equal(calls.length, 3);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await assert.rejects(readPhoto(path), /Configure the private Blob/);
    assert.equal(calls.length, 3);
  } finally {
    setGlobalDispatcher(dispatcher);
    await agent.close();
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("configuration rejects incomplete emulator wiring and production emulator fallbacks", () => {
  const old = process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  assert.throws(config, /three explicit loopback/);
  process.env.FIRESTORE_EMULATOR_HOST = old;
  process.env.FUTEIO_FIREBASE_MODE = "production";
  assert.throws(config, /Production cannot/);
  process.env.FUTEIO_FIREBASE_MODE = "emulator";
  const alias = process.env.STORAGE_EMULATOR_HOST;
  process.env.STORAGE_EMULATOR_HOST = "https://unexpected.example";
  assert.throws(config, /Storage endpoint must match/);
  if (alias) process.env.STORAGE_EMULATOR_HOST = alias;
  else delete process.env.STORAGE_EMULATOR_HOST;
});

test("admin authenticates with Firebase Auth and gets an opaque HttpOnly session", async () => {
  const initial = await anonymous();
  await requireCsrf(request(initial.cookie, initial.csrf));
  await assert.rejects(requireCsrf(request(initial.cookie)), isStatus(403));
  await assert.rejects(requireCsrf(request(initial.cookie, initial.csrf, "https://other.example")), isStatus(403));
  await assert.rejects(loginAdministrator(request(initial.cookie), { email: TEST_ADMIN_EMAIL, password: "wrong" }), isStatus(401));
  await assert.rejects(loginAdministrator(request(initial.cookie), { email: "unknown@example.test", password: TEST_ADMIN_PASSWORD }), isStatus(401));
  const signedIn = await loginAdministrator(request(initial.cookie), { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
  assert.match(signedIn.cookie, /HttpOnly; SameSite=Lax/);
  assert.notEqual(signedIn.cookie, initial.cookie);
  assert.equal((await currentSession(request(signedIn.cookie))).role, "ADMIN");
  await assert.rejects(requireCsrf(request(signedIn.cookie, initial.csrf)), isStatus(403));
  const hash = secretHash(signedIn.cookie.split(";")[0]!.split("=")[1]!);
  const record = await firebase().db.collection("sessions").doc(hash).get();
  assert.equal(record.get("role"), "ADMIN");
  assert.equal(JSON.stringify(record.data()).includes(TEST_ADMIN_PASSWORD), false);
  await logout(request(signedIn.cookie));
  await assert.rejects(currentSession(request(signedIn.cookie)), isStatus(401));
});

test("only the configured Auth UID can become administrator and disabled accounts lose sessions", async () => {
  const uid = config().adminUid;
  process.env.FIREBASE_ADMIN_UID = "different-uid";
  await assert.rejects(loginAdministrator(request(), { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }), isStatus(401));
  process.env.FIREBASE_ADMIN_UID = uid;
  const initial = await anonymous();
  const login = await loginAdministrator(request(initial.cookie), { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
  await firebase().auth.updateUser(uid, { disabled: true });
  try { await assert.rejects(currentSession(request(login.cookie)), isStatus(401)); }
  finally { await firebase().auth.updateUser(uid, { disabled: false }); }
});

test("concurrent admin logins consume the previous session once", async () => {
  const initial = await anonymous();
  const attempts = await Promise.allSettled([0, 1].map(() => loginAdministrator(request(initial.cookie), { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })));
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  const rejected = attempts.find((attempt) => attempt.status === "rejected");
  assert.ok(rejected && isStatus(401)(rejected.reason));
  const fulfilled = attempts.find((attempt) => attempt.status === "fulfilled");
  assert.equal((await currentSession(request(fulfilled!.value.cookie))).role, "ADMIN");
});

test("temporary Auth failures preserve the session for a later retry", async () => {
  const initial = await anonymous();
  const login = await loginAdministrator(request(initial.cookie), { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
  const fault = mock.method(firebase().auth, "getUser", async () => { throw new Error("Synthetic Auth outage"); });
  try { await assert.rejects(currentSession(request(login.cookie)), isStatus(503)); }
  finally { fault.mock.restore(); }
  assert.equal((await currentSession(request(login.cookie))).role, "ADMIN");
});

test("Google uses the configured UID and creates only the same opaque administrator session", async () => {
  const initial = await anonymous();
  const token = await googleToken();
  const login = await loginAdministratorWithGoogle(request(initial.cookie), { idToken: token });
  assert.equal(login.body.role, "ADMIN");
  assert.equal((await currentSession(request(login.cookie))).identityId, ADMIN_ID);
  assert.equal(login.cookie.includes(token), false);
  const raw = login.cookie.split(";")[0]!.split("=")[1]!;
  const row = await firebase().db.collection("sessions").doc(secretHash(raw)).get();
  assert.equal(JSON.stringify(row.data()).includes(token), false);
  await logout(request(login.cookie));
});

test("Google rejects another account, wrong providers, tampered and stale tokens", async () => {
  const initial = await anonymous();
  const other = await googleToken("unapproved-google-subject", "other-google@example.test");
  await assert.rejects(loginAdministratorWithGoogle(request(initial.cookie), { idToken: other }), isStatus(401));
  await assert.rejects(loginAdministratorWithGoogle(request(initial.cookie), { idToken: "tampered" }), isStatus(401));
  const password = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD, returnSecureToken: true }) });
  await assert.rejects(loginAdministratorWithGoogle(request(initial.cookie), { idToken: (await password.json()).idToken }), isStatus(401));
  const valid = await googleToken();
  const parts = valid.split(".");
  const foreign = { ...JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")), aud: "another-project", iss: "https://securetoken.google.com/another-project" };
  const foreignToken = `${parts[0]}.${Buffer.from(JSON.stringify(foreign)).toString("base64url")}.${parts[2]}`;
  await assert.rejects(loginAdministratorWithGoogle(request(initial.cookie), { idToken: foreignToken }), isStatus(401));
  const verified = await firebase().auth.verifyIdToken(valid, true);
  const fault = mock.method(firebase().auth, "verifyIdToken", async () => ({ ...verified, auth_time: Math.floor(Date.now() / 1000) - 601 }));
  try { await assert.rejects(loginAdministratorWithGoogle(request(initial.cookie), { idToken: valid }), isStatus(401)); }
  finally { fault.mock.restore(); }
  await assert.rejects(currentSession(request(initial.cookie)), isStatus(401));
});

test("Google cannot rotate one anonymous session into two administrator sessions", async () => {
  const initial = await anonymous();
  const idToken = await googleToken();
  const attempts = await Promise.allSettled([0, 1].map(() => loginAdministratorWithGoogle(request(initial.cookie), { idToken })));
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  const rejected = attempts.find((attempt) => attempt.status === "rejected");
  assert.ok(rejected && isStatus(401)(rejected.reason));
});

test("Firestore quotas stop attempts and expiry is enforced by the server", async () => {
  await rateLimit("test", "shared", 2);
  await rateLimit("test", "shared", 2);
  await assert.rejects(rateLimit("test", "shared", 2), isStatus(429));
  const player = await member();
  const raw = player.cookie.split(";")[0]!.split("=")[1]!;
  await firebase().db.collection("sessions").doc(secretHash(raw)).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  await assert.rejects(currentSession(request(player.cookie)), isStatus(401));
});

test("registration is atomic, validates integer notes and links one admin profile", async () => {
  const own = await players.createPlayer(admin, { name: "Administrador sintético", initialRating: 5, linkToCurrentAdministrator: true });
  assert.equal(own.player.isOwnProfile, true);
  assert.equal((await players.getEvaluations(admin, own.player.id)).evaluationCount, 1);
  await assert.rejects(players.createPlayer(admin, { name: "Duplicate", initialRating: 5, linkToCurrentAdministrator: true }), isStatus(409));
  for (const initialRating of [-1, 11, 2.5]) await assert.rejects(players.createPlayer(admin, { name: "Invalid", initialRating }), isStatus(400));
  await assert.rejects(players.createPlayer(admin, { name: "Invalid", initialRating: 2, role: "ADMIN" }), isStatus(400));
  const first = await member("Mesmo nome", 0);
  const second = await member("Mesmo nome", 10);
  assert.notEqual(first.player.id, second.player.id);
  const roster = await players.listPlayers(first.session);
  assert.equal(roster.some((player) => player.id === first.player.id && player.isOwnProfile), true);
  assert.equal(JSON.stringify(roster).includes(first.token), false);
  assert.equal(JSON.stringify(roster).includes("credential"), false);
  await assert.rejects(players.createPlayer(first.session, { name: "Denied", initialRating: 7 }), isStatus(403));
  await assert.rejects(players.updatePlayer(first.session, second.player.id, { name: "Denied" }), isStatus(403));
});

test("current votes replace earlier values, include self ratings and hide other authors", async () => {
  const target = await member("Alvo", 1);
  const evaluator = await member("Avaliador", 6);
  await players.ratePlayer(evaluator.session, target.player.id, { rating: 8 });
  await players.ratePlayer(evaluator.session, target.player.id, { rating: 6 });
  const table = await players.getEvaluations(evaluator.session, target.player.id);
  assert.equal(table.evaluationCount, 2);
  assert.equal(table.rating, 3.5);
  assert.deepEqual(table.evaluations.filter((row) => !row.isOwn), [{ rating: 1, isOwn: false }]);
  assert.equal(table.evaluations.find((row) => row.isOwn)?.authorName, "Avaliador");
  assert.ok((await players.getEvaluations(admin, target.player.id)).evaluations.every((row) => row.authorName));
  await players.ratePlayer(target.session, target.player.id, { rating: 9 });
  assert.equal((await players.getEvaluations(admin, target.player.id)).evaluationCount, 3);
  await assert.rejects(players.ratePlayer(target.session, target.player.id, { rating: 3.5 }), isStatus(400));
});

test("concurrent votes retain every current contribution and trim at five and eleven", async () => {
  const target = await member("Extremos", 0);
  const voters = await Promise.all(Array.from({ length: 10 }, (_, i) => member(`Avaliador ${i}`, 5)));
  const ratings = [0, 1, 2, 3, 4, 5, 6, 7, 10, 10];
  // Four concurrent evaluations plus the original admin vote cross the first boundary.
  await Promise.all(voters.slice(0, 4).map((voter, i) => players.ratePlayer(voter.session, target.player.id, { rating: ratings[i] })));
  const five = await players.getEvaluations(admin, target.player.id);
  assert.equal(five.evaluationCount, 5);
  assert.equal(five.discardedPerSide, 1);
  assert.equal(five.rating, 1);
  await Promise.all(voters.slice(4).map((voter, i) => players.ratePlayer(voter.session, target.player.id, { rating: ratings[i + 4] })));
  const eleven = await players.getEvaluations(admin, target.player.id);
  assert.equal(eleven.evaluationCount, 11);
  assert.equal(eleven.discardedPerSide, 2);
  assert.equal(eleven.rating, 4);
  assert.equal((await players.listPlayers(admin)).find((player) => player.id === target.player.id)?.rating, 4);
});

test("rotating or revoking a link invalidates old sessions and credentials", async () => {
  const player = await member("Acesso");
  assert.equal((await currentSession(request(player.cookie))).playerId, player.player.id);
  await assert.rejects(players.rotateLink(player.session, player.player.id), isStatus(403));
  const rotated = await players.rotateLink(admin, player.player.id);
  await assert.rejects(currentSession(request(player.cookie)), isStatus(401));
  await assert.rejects(redeemPlayer(request(), { token: player.token }), isStatus(401));
  const token = new URLSearchParams(new URL(rotated.accessUrl).hash.slice(1)).get("token")!;
  const result = await redeemPlayer(request(), { token });
  await players.revokeLink(admin, player.player.id);
  await assert.rejects(currentSession(request(result.cookie)), isStatus(401));
  await assert.rejects(redeemPlayer(request(), { token }), isStatus(401));
});

test("rotation racing redemption never leaves a valid session for the old credential", async () => {
  const player = await member("Corrida");
  const outcomes = await Promise.allSettled([redeemPlayer(request(), { token: player.token }), players.rotateLink(admin, player.player.id)]);
  assert.equal(outcomes[1]!.status, "fulfilled");
  const result = outcomes[0]!;
  if (result.status === "fulfilled") await assert.rejects(currentSession(request(result.value.cookie)), isStatus(401));
  else assert.ok(isStatus(401)(result.reason));
});

test("photos are normalized private JPEGs and only the owner or admin can edit", async () => {
  const owner = await member("Foto");
  const other = await member("Outro");
  const data = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNQKHZRKHZhgFAAFwIDXaggaA8AAAAASUVORK5CYII=";
  await assert.rejects(players.uploadPhoto(other.session, owner.player.id, { data }), isStatus(403));
  await assert.rejects(players.uploadPhoto(owner.session, owner.player.id, { data: "not-a-photo" }), isStatus(400));
  await players.uploadPhoto(owner.session, owner.player.id, { data });
  const photo = await players.getPhoto(other.session, owner.player.id);
  assert.equal(photo[0], 0xff);
  assert.equal(photo[1], 0xd8);
  const path = (await firebase().db.doc(`groups/${GROUP_ID}/players/${owner.player.id}`).get()).get("photoPath");
  const direct = await fetch(`http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${config().bucket}/o/${encodeURIComponent(path)}?alt=media`);
  assert.equal(direct.status, 403);
  await players.removePhoto(owner.session, owner.player.id);
  await assert.rejects(players.getPhoto(admin, owner.player.id), isStatus(404));
});

test("draws use twenty selected participants and keep an immutable rating snapshot", async () => {
  const selected = await Promise.all(Array.from({ length: 20 }, (_, i) => players.createPlayer(admin, { name: `Camisa ${i}`, initialRating: i % 11 })));
  const playerIds = selected.map((item) => item.player.id);
  const draw = await draws.createDraw(admin, { playerIds, seed: "fixed-seed" });
  assert.deepEqual(draw.teams.map((team) => team.players.length), [5, 5, 5, 5]);
  assert.equal(new Set(draw.teams.flatMap((team) => team.players.map((player) => player.id))).size, 20);
  await players.ratePlayer(admin, playerIds[0]!, { rating: 10 });
  await players.updatePlayer(admin, playerIds[0]!, { name: "Alterado depois" });
  assert.deepEqual(await draws.getDraw(admin, draw.id), draw);
  assert.ok((await draws.listDraws(admin)).some((item) => item.id === draw.id));
  await assert.rejects(draws.createDraw(admin, { playerIds: playerIds.slice(1) }), isStatus(400));
  await assert.rejects(draws.createDraw(admin, { playerIds: [...playerIds.slice(1), playerIds[1]] }), isStatus(400));
  const memberSession = (await member()).session;
  await assert.rejects(draws.createDraw(memberSession, { playerIds }), isStatus(403));
  assert.deepEqual(await draws.getDraw(memberSession, draw.id), draw);
});

test("a lost Firestore commit acknowledgement never deletes the referenced photo", async () => {
  const owner = await member("Foto confirmada");
  const { db } = firebase();
  const bucket = emulatorBucket();
  const original = db.runTransaction.bind(db);
  const fault = mock.method(db, "runTransaction", async (...args: Parameters<typeof db.runTransaction>) => {
    await original(...args);
    throw new Error("Synthetic lost acknowledgement");
  });
  try {
    await assert.rejects(players.uploadPhoto(owner.session, owner.player.id, { data: "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNQKHZRKHZhgFAAFwIDXaggaA8AAAAASUVORK5CYII=" }), /Synthetic lost acknowledgement/);
  } finally { fault.mock.restore(); }
  const record = await db.doc(`groups/${GROUP_ID}/players/${owner.player.id}`).get();
  const path = record.get("photoPath") as string;
  assert.ok(path);
  assert.equal((await bucket.file(path).exists())[0], true);
  assert.equal((await players.getPhoto(owner.session, owner.player.id))[0], 0xff);
});

test("client Firestore REST access is denied even with a valid Firebase Auth token", async () => {
  const rest = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${config().projectId}/databases/(default)/documents/groups/${GROUP_ID}/players`;
  assert.equal((await fetch(rest)).status, 403);
  const login = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD, returnSecureToken: true }) });
  const token = (await login.json()).idToken as string;
  assert.equal((await fetch(rest, { headers: { Authorization: `Bearer ${token}` } })).status, 403);
  assert.equal((await fetch(`${rest}/unexpected`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: { name: { stringValue: "Denied" } } }) })).status, 403);
});
