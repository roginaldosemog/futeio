import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { FieldPath } from "firebase-admin/firestore";
import type { components } from "../generated/api-types.ts";
import { firebase } from "./firebase.ts";
import { GROUP_ID, HttpError, fields, requireAdmin, requireId, type Session } from "./context.ts";
import { RATING_CALCULATION_VERSION } from "./domain/calculate-rating.ts";
import { balanceTeams, DRAW_ALGORITHM_VERSION } from "./domain/balance-teams.ts";

type Draw = components["schemas"]["DrawDto"];
type StoredDraw = Draw & { createdBy: string };

function collection(session: Session) {
  if (session.groupId !== GROUP_ID) throw new HttpError(403, "Grupo indisponível.");
  return firebase().db.collection("groups").doc(GROUP_ID).collection("draws");
}

function view(draw: StoredDraw): Draw {
  return {
    id: draw.id,
    createdAt: draw.createdAt,
    seed: draw.seed,
    algorithmVersion: draw.algorithmVersion,
    calculationVersion: draw.calculationVersion,
    teams: draw.teams.map((team) => ({
      number: team.number,
      players: team.players.map((player) => ({ id: player.id, name: player.name, rating: player.rating })),
      total: team.total,
      average: team.average,
    })),
    spread: draw.spread,
    variance: draw.variance,
  };
}

export async function listDraws(session: Session): Promise<Draw[]> {
  const rows = await collection(session).orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc").limit(50).get();
  return rows.docs.map((row) => view(row.data() as StoredDraw));
}

export async function getDraw(session: Session, id: string): Promise<Draw> {
  const row = await collection(session).doc(requireId(id)).get();
  if (!row.exists) throw new HttpError(404, "Sorteio não encontrado.");
  return view(row.data() as StoredDraw);
}

export async function createDraw(session: Session, body: unknown): Promise<Draw> {
  const draws = collection(session);
  requireAdmin(session);
  const input = fields(body, ["playerIds", "seed"]);
  if (!Array.isArray(input.playerIds) || input.playerIds.length !== 20 || input.playerIds.some((id) => typeof id !== "string")) throw new HttpError(400, "Selecione exatamente 20 jogadores diferentes.");
  const ids = (input.playerIds as string[]).map(requireId);
  if (new Set(ids).size !== 20) throw new HttpError(400, "Selecione exatamente 20 jogadores diferentes.");
  if (input.seed !== undefined && (typeof input.seed !== "string" || [...input.seed].length < 1 || [...input.seed].length > 64)) throw new HttpError(400, "A semente deve ter entre 1 e 64 caracteres.");
  const seed = input.seed as string | undefined ?? randomBytes(16).toString("hex");
  const id = randomUUID();
  const { db } = firebase();
  return db.runTransaction(async (transaction) => {
    const players = draws.parent!.collection("players");
    const snapshots = await transaction.getAll(...ids.map((playerId) => players.doc(playerId)));
    if (snapshots.some((player) => !player.exists)) throw new HttpError(404, "Um participante não está disponível neste grupo.");
    const rated = snapshots.map((snapshot) => {
      const player = snapshot.data() as { id: string; name: string; rating: number };
      return { id: snapshot.id, name: player.name, rating: player.rating };
    });
    const result = balanceTeams(rated, seed);
    const names = new Map(rated.map((player) => [player.id, player.name]));
    const teams = result.teams.map((team, index) => {
      const members = team.map((player) => ({ id: player.id, name: names.get(player.id)!, rating: player.rating }));
      const total = members.reduce((sum, player) => sum + player.rating, 0);
      return { number: index + 1, players: members, total, average: total / 5 };
    });
    const draw: Draw = {
      id, createdAt: new Date().toISOString(), seed,
      algorithmVersion: DRAW_ALGORITHM_VERSION, calculationVersion: RATING_CALCULATION_VERSION,
      teams, spread: result.spread, variance: result.variance,
    };
    transaction.create(draws.doc(id), { ...draw, createdBy: session.identityId });
    return draw;
  });
}
