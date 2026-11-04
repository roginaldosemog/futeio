import type { components } from "@futeio/contracts";
import { apiMutation, apiRequest } from "@/lib/api-client";

export type PlayerSummary = components["schemas"]["PlayerSummaryDto"];
export type CreatePlayerInput = components["schemas"]["CreatePlayerDto"];
export type CreatePlayerResult = components["schemas"]["CreatePlayerResponseDto"];
export type PlayerProfile = components["schemas"]["PlayerProfileDto"];
export type PlayerEvaluations = components["schemas"]["PlayerEvaluationsDto"];

export async function listPlayers(signal?: AbortSignal): Promise<PlayerSummary[]> {
  const response = await apiRequest("players", { signal });
  return response.json();
}
export async function createPlayer(input: CreatePlayerInput): Promise<CreatePlayerResult> {
  const response = await apiMutation("players", {
    name: input.name,
    initialRating: input.initialRating,
    ...(input.linkToCurrentAdministrator === undefined
      ? {}
      : { linkToCurrentAdministrator: input.linkToCurrentAdministrator }),
  });
  return response.json();
}

export async function getPlayer(id: string, signal?: AbortSignal): Promise<PlayerProfile> {
  return (await apiRequest(`players/${encodeURIComponent(id)}`, { signal })).json();
}
export async function getEvaluations(id: string, signal?: AbortSignal): Promise<PlayerEvaluations> {
  return (await apiRequest(`players/${encodeURIComponent(id)}/evaluations`, { signal })).json();
}
export async function ratePlayer(id: string, rating: number): Promise<void> {
  await apiMutation(`players/${encodeURIComponent(id)}/evaluations`, { rating });
}
export async function updatePlayer(id: string, name: string): Promise<void> {
  await apiMutation(`players/${encodeURIComponent(id)}/profile`, { name });
}
export async function uploadPhoto(id: string, data: string): Promise<void> {
  await apiMutation(`players/${encodeURIComponent(id)}/photo`, { data });
}
export async function removePhoto(id: string): Promise<void> {
  await apiMutation(`players/${encodeURIComponent(id)}/photo`, {}, "DELETE");
}
export async function rotateLink(id: string): Promise<{ accessUrl: string }> {
  return (await apiMutation(`players/${encodeURIComponent(id)}/access-link/rotate`)).json();
}
export async function revokeLink(id: string): Promise<void> {
  await apiMutation(`players/${encodeURIComponent(id)}/access-link`, {}, "DELETE");
}
