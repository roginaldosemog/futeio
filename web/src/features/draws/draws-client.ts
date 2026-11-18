import type { components } from "@/generated/api-types";
import { apiMutation, apiRequest } from "@/lib/api-client";

export type Draw = components["schemas"]["DrawDto"];
export async function listDraws(signal?: AbortSignal): Promise<Draw[]> {
  return (await apiRequest("draws", { signal })).json();
}
export async function getDraw(id: string, signal?: AbortSignal): Promise<Draw> {
  return (await apiRequest(`draws/${encodeURIComponent(id)}`, { signal })).json();
}
export async function createDraw(playerIds: string[]): Promise<Draw> {
  return (await apiMutation("draws", { playerIds })).json();
}
