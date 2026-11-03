import type { components } from "@/generated/api-types";
import { apiMutation, apiRequest } from "@/lib/api-client";

export type PlayerSummary = components["schemas"]["PlayerSummaryDto"];
export type CreatePlayerInput = components["schemas"]["CreatePlayerDto"];
export type CreatePlayerResult = components["schemas"]["CreatePlayerResponseDto"];

export async function listPlayers(signal?: AbortSignal): Promise<PlayerSummary[]> {
  const response = await apiRequest("players", { signal });
  return response.json();
}
export async function createPlayer(input: CreatePlayerInput): Promise<CreatePlayerResult> {
  const response = await apiMutation("players", {
    name: input.name,
    initialRating: input.initialRating,
    ...(input.linkToCurrentAdministrator === undefined ? {} : { linkToCurrentAdministrator: input.linkToCurrentAdministrator }),
  });
  return response.json();
}
