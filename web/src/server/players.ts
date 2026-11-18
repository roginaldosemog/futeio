import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { FieldPath, FieldValue, Timestamp, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import sharp from "sharp";
import type { components } from "../generated/api-types.ts";
import { firebase, config } from "./firebase.ts";
import { ADMIN_ID, GROUP_ID, HttpError, fields, integerRating, playerName, requireAdmin, requireId, type Session } from "./context.ts";
import { calculateRating, discardedPerSide, RATING_CALCULATION_VERSION } from "./domain/calculate-rating.ts";

type Schemas = components["schemas"];
type Player = {
  id: string;
  identityId: string;
  name: string;
  rating: number;
  evaluationCount: number;
  photoPath?: string;
  credentialHash: string | null;
  credentialVersion: number;
};
type Evaluation = { identityId: string; rating: number };

function group(session: Session) {
  if (session.groupId !== GROUP_ID) throw new HttpError(403, "Grupo indisponível.");
  return firebase().db.collection("groups").doc(GROUP_ID);
}

function playerFrom(snapshot: DocumentSnapshot<DocumentData>): Player {
  if (!snapshot.exists) throw new HttpError(404, "Jogador não encontrado.");
  return snapshot.data() as Player;
}

function canEdit(session: Session, player: Player) {
  return session.role === "ADMIN" || session.identityId === player.identityId;
}

function requireEdit(session: Session, player: Player) {
  if (!canEdit(session, player)) throw new HttpError(403, "Você não pode editar este jogador.");
}

function profile(session: Session, player: Player): Schemas["PlayerProfileDto"] {
  return {
    id: player.id,
    name: player.name,
    rating: player.rating,
    isOwnProfile: player.identityId === session.identityId,
    canEdit: canEdit(session, player),
    ...(player.photoPath ? { photoUrl: `/api/v1/players/${player.id}/photo` } : {}),
  };
}

function newCredential() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

function accessUrl(token: string) {
  const url = new URL("/acesso/jogador", config().origin);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export async function listPlayers(session: Session): Promise<Schemas["PlayerSummaryDto"][]> {
  const collection = group(session).collection("players");
  const { db } = firebase();
  const players = await collection.orderBy("createdAt", "asc").orderBy(FieldPath.documentId(), "asc").limit(500).get();
  if (!players.size) return [];
  const ownVotes = await db.getAll(...players.docs.map((row) => row.ref.collection("evaluations").doc(session.identityId)));
  return players.docs.map((row, index) => {
    const player = playerFrom(row);
    return {
      id: player.id,
      name: player.name,
      rating: player.rating,
      isOwnProfile: player.identityId === session.identityId,
      myRating: (ownVotes[index]!.data() as Evaluation | undefined)?.rating ?? null,
      evaluationCount: player.evaluationCount,
      ...(player.photoPath ? { photoUrl: `/api/v1/players/${player.id}/photo` } : {}),
    };
  });
}

export async function createPlayer(session: Session, body: unknown): Promise<Schemas["CreatePlayerResponseDto"]> {
  const reference = group(session);
  requireAdmin(session);
  const input = fields(body, ["name", "initialRating", "linkToCurrentAdministrator"]);
  const name = playerName(input.name);
  const initialRating = integerRating(input.initialRating);
  if (input.linkToCurrentAdministrator !== undefined && typeof input.linkToCurrentAdministrator !== "boolean") throw new HttpError(400, "Dados inválidos.");
  const own = input.linkToCurrentAdministrator === true;
  const identityId = own ? ADMIN_ID : randomUUID();
  const id = randomUUID();
  const credential = newCredential();
  const { db } = firebase();
  await db.runTransaction(async (transaction) => {
    const membership = reference.collection("members").doc(identityId);
    if (own) {
      const member = await transaction.get(membership);
      const existing = await transaction.get(reference.collection("players").where("identityId", "==", ADMIN_ID).limit(1));
      if (member.data()?.playerId || !existing.empty) throw new HttpError(409, "Já existe um perfil para o administrador neste grupo.");
    }
    const now = Timestamp.now();
    const player = reference.collection("players").doc(id);
    transaction.create(player, {
      id, identityId, name, rating: initialRating, evaluationCount: 1,
      credentialHash: credential.hash, credentialVersion: 1, createdAt: now, updatedAt: now,
    });
    transaction.set(membership, { identityId, role: own ? "ADMIN" : "PLAYER", playerId: id }, { merge: true });
    transaction.create(player.collection("evaluations").doc(ADMIN_ID), { identityId: ADMIN_ID, rating: initialRating, updatedAt: now });
    transaction.create(db.collection("playerCredentials").doc(credential.hash), {
      groupId: GROUP_ID, playerId: id, identityId, version: 1, createdAt: now,
    });
  });
  return { player: { id, name, rating: initialRating, isOwnProfile: own }, accessUrl: accessUrl(credential.token) };
}

export async function getPlayer(session: Session, id: string): Promise<Schemas["PlayerProfileDto"]> {
  const reference = group(session).collection("players").doc(requireId(id));
  return profile(session, playerFrom(await reference.get()));
}

export async function updatePlayer(session: Session, id: string, body: unknown): Promise<Schemas["PlayerProfileDto"]> {
  const reference = group(session).collection("players").doc(requireId(id));
  const name = playerName(fields(body, ["name"]).name);
  const updated = await firebase().db.runTransaction(async (transaction) => {
    const player = playerFrom(await transaction.get(reference));
    requireEdit(session, player);
    transaction.update(reference, { name, updatedAt: Timestamp.now() });
    return { ...player, name };
  });
  return profile(session, updated);
}

async function evaluationView(session: Session, evaluations: Evaluation[]): Promise<Schemas["PlayerEvaluationsDto"]> {
  const reference = group(session);
  const { db } = firebase();
  const named = evaluations.filter((evaluation) => session.role === "ADMIN" || evaluation.identityId === session.identityId);
  const identities = [...new Set(named.map((evaluation) => evaluation.identityId))];
  const names = new Map<string, string>();
  if (identities.length) {
    const members = await db.getAll(...identities.map((identityId) => reference.collection("members").doc(identityId)));
    const linked = members.flatMap((member, index) => {
      const playerId = member.data()?.playerId as string | undefined;
      return playerId ? [{ identityId: identities[index]!, playerId }] : [];
    });
    if (linked.length) {
      const players = await db.getAll(...linked.map(({ playerId }) => reference.collection("players").doc(playerId)));
      players.forEach((player, index) => {
        if (player.exists) names.set(linked[index]!.identityId, (player.data() as Player).name);
      });
    }
  }
  const ratings = evaluations.map(({ rating }) => rating);
  const rows = evaluations.map((evaluation) => {
    const isOwn = evaluation.identityId === session.identityId;
    return {
      rating: evaluation.rating,
      isOwn,
      ...(isOwn || session.role === "ADMIN" ? { authorName: names.get(evaluation.identityId) ?? "Administrador" } : {}),
    };
  }).sort((left, right) => left.rating - right.rating || Number(left.isOwn) - Number(right.isOwn) || (left.authorName ?? "").localeCompare(right.authorName ?? "", "pt-BR"));
  return { evaluations: rows, rating: calculateRating(ratings), evaluationCount: ratings.length, discardedPerSide: discardedPerSide(ratings.length), calculationVersion: RATING_CALCULATION_VERSION };
}

export async function getEvaluations(session: Session, id: string): Promise<Schemas["PlayerEvaluationsDto"]> {
  const reference = group(session).collection("players").doc(requireId(id));
  const [player, evaluations] = await Promise.all([reference.get(), reference.collection("evaluations").get()]);
  playerFrom(player);
  return evaluationView(session, evaluations.docs.map((row) => row.data() as Evaluation));
}

export async function ratePlayer(session: Session, id: string, body: unknown): Promise<Schemas["PlayerEvaluationsDto"]> {
  const reference = group(session).collection("players").doc(requireId(id));
  const rating = integerRating(fields(body, ["rating"]).rating);
  const evaluations = await firebase().db.runTransaction(async (transaction) => {
    playerFrom(await transaction.get(reference));
    const current = await transaction.get(reference.collection("evaluations"));
    const votes = current.docs.map((row) => row.data() as Evaluation).filter((row) => row.identityId !== session.identityId);
    votes.push({ identityId: session.identityId, rating });
    const now = Timestamp.now();
    transaction.set(reference.collection("evaluations").doc(session.identityId), { identityId: session.identityId, rating, updatedAt: now });
    transaction.update(reference, { rating: calculateRating(votes.map((row) => row.rating)), evaluationCount: votes.length, updatedAt: now });
    return votes;
  }, { maxAttempts: 15 });
  return evaluationView(session, evaluations);
}

async function normalizePhoto(value: unknown): Promise<Buffer> {
  if (typeof value !== "string" || value.length < 4 || value.length > 2_796_204 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new HttpError(400, "Envie uma foto JPEG ou PNG válida.");
  const input = Buffer.from(value, "base64");
  if (!input.length || input.length > 2 * 1024 * 1024) throw new HttpError(400, "A foto deve ter até 2 MiB.");
  if (input.toString("base64") !== value) throw new HttpError(400, "Envie uma foto JPEG ou PNG válida.");
  try {
    const image = sharp(input, { failOn: "warning", limitInputPixels: 16_777_216, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
    return await image.rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    throw new HttpError(400, "Envie uma foto JPEG ou PNG válida, de até 16 megapixels.");
  }
}

async function deletePhoto(path: string | undefined) {
  if (path) await firebase().bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined);
}

export async function uploadPhoto(session: Session, id: string, body: unknown): Promise<Schemas["PlayerProfileDto"]> {
  const reference = group(session).collection("players").doc(requireId(id));
  const input = fields(body, ["data"]);
  requireEdit(session, playerFrom(await reference.get()));
  const bytes = await normalizePhoto(input.data);
  const photoPath = `groups/${GROUP_ID}/players/${id}/${randomUUID()}.jpg`;
  const { db, bucket } = firebase();
  const object = bucket.file(photoPath);
  let result: { player: Player; previous?: string };
  try {
    await object.save(bytes, { resumable: false, metadata: { contentType: "image/jpeg", cacheControl: "private, no-store" } });
    result = await db.runTransaction(async (transaction) => {
      const player = playerFrom(await transaction.get(reference));
      requireEdit(session, player);
      transaction.update(reference, { photoPath, updatedAt: Timestamp.now() });
      return { player: { ...player, photoPath }, previous: player.photoPath };
    });
  } catch (error) {
    // A commit may succeed even if its acknowledgement is lost. Never compensate
    // by removing an object that the database may already reference.
    try {
      const confirmed = await reference.get();
      if (confirmed.get("photoPath") !== photoPath) await deletePhoto(photoPath);
    } catch { /* Preserve a private orphan rather than risk deleting a live photo. */ }
    throw error;
  }
  await deletePhoto(result.previous);
  return profile(session, result.player);
}

export async function removePhoto(session: Session, id: string): Promise<Schemas["PlayerProfileDto"]> {
  const reference = group(session).collection("players").doc(requireId(id));
  const result = await firebase().db.runTransaction(async (transaction) => {
    const player = playerFrom(await transaction.get(reference));
    requireEdit(session, player);
    transaction.update(reference, { photoPath: FieldValue.delete(), updatedAt: Timestamp.now() });
    const { photoPath, ...withoutPhoto } = player;
    return { previous: photoPath, player: withoutPhoto };
  });
  await deletePhoto(result.previous);
  return profile(session, result.player);
}

export async function getPhoto(session: Session, id: string): Promise<Buffer> {
  const reference = group(session).collection("players").doc(requireId(id));
  const player = playerFrom(await reference.get());
  if (!player.photoPath) throw new HttpError(404, "Foto não encontrada.");
  try {
    const [bytes] = await firebase().bucket.file(player.photoPath).download();
    return bytes;
  } catch (error) {
    if ((error as { code?: number }).code === 404) throw new HttpError(404, "Foto não encontrada.");
    throw error;
  }
}

async function changeLink(session: Session, id: string, rotate: boolean) {
  const reference = group(session).collection("players").doc(requireId(id));
  requireAdmin(session);
  const credential = rotate ? newCredential() : undefined;
  const { db } = firebase();
  await db.runTransaction(async (transaction) => {
    const player = playerFrom(await transaction.get(reference));
    const version = player.credentialVersion + 1;
    const now = Timestamp.now();
    if (player.credentialHash) transaction.delete(db.collection("playerCredentials").doc(player.credentialHash));
    transaction.update(reference, { credentialHash: credential?.hash ?? null, credentialVersion: version, updatedAt: now });
    if (credential) transaction.create(db.collection("playerCredentials").doc(credential.hash), {
      groupId: GROUP_ID, playerId: id, identityId: player.identityId, version, createdAt: now,
    });
  });
  return credential ? accessUrl(credential.token) : undefined;
}

export async function rotateLink(session: Session, id: string): Promise<Schemas["PlayerAccessLinkDto"]> {
  return { accessUrl: (await changeLink(session, id, true))! };
}

export async function revokeLink(session: Session, id: string): Promise<Schemas["MessageResponseDto"]> {
  await changeLink(session, id, false);
  return { message: "Acesso por link revogado." };
}
