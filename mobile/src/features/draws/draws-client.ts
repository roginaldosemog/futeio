import type { components } from '@futeio/contracts';
import { apiRequest } from '../../lib/api';

export type Draw = components['schemas']['DrawDto'];
export type DrawParticipant = components['schemas']['PlayerSummaryDto'];

export const listDraws = (signal?: AbortSignal) => apiRequest<Draw[]>('draws', { signal });
export const getDraw = (id: string, signal?: AbortSignal) => apiRequest<Draw>(`draws/${encodeURIComponent(id)}`, { signal });
export const listParticipants = (signal?: AbortSignal) => apiRequest<DrawParticipant[]>('players', { signal });
export function createDraw(playerIds: string[]): Promise<Draw> {
  const body: components['schemas']['CreateDrawDto'] = { playerIds };
  return apiRequest<Draw>('draws', { method: 'POST', body });
}

export const formatNumber = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export const formatDrawDate = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
