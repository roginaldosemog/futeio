import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp } from "firebase-admin/firestore";
import { config, firebase } from "../src/server/firebase.ts";
import { ADMIN_ID, GROUP_ID, HttpError, type Session } from "../src/server/context.ts";
import { csrfResponse, currentSession, loginAdministrator, logout, redeemPlayer, requireCsrf, rateLimit, secretHash } from "../src/server/access.ts";
import * as players from "../src/server/players.ts";
import * as draws from "../src/server/draws.ts";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./admin-fixture.mjs";

const origin = process.env.APP_ORIGIN!;
const admin: Session = { role: "ADMIN", identityId: ADMIN_ID, groupId: GROUP_ID, email: TEST_ADMIN_EMAIL };
const isStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;
const request = (cookie?: string, csrf?: string, requestOrigin = origin) => new Request(`${origin}/api/v1/auth/me`, { headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie.split(";")[0]! } : {}), ...(csrf ? { "x-csrf-token": csrf } : {}) } });
async function anonymous() {
  const response = await csrfResponse(request());
  return { cookie: response.cookie!, csrf: response.body.csrfToken };
}
async function member(name = "Jogador sintético", rating = 7) {
  const created = await players.createPlayer(admin, { name, initialRating: rating });
  const token = new URLSearchParams(new URL(created.accessUrl).hash.slice(1)).get("token")!;
  const result = await redeemPlayer(request(), { token });
  return { ...created, token, cookie: result.cookie, session: result.body };
}

before(async () => {
  assert.equal(config().projectId, "demo-futeio-test");
  await firebase().db.recursiveDelete(firebase().db.doc(`groups/${GROUP_ID}`));
});
beforeEach(async () => {
  await firebase().db.recursiveDelete(firebase().db.collection("rateLimits"));
});
after(async () => { await Promise.all(getApps().map(deleteApp)); });

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
  const { db, bucket } = firebase();
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
