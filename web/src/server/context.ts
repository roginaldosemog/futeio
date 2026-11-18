import type { components } from "../generated/api-types.ts";

export type Session = components["schemas"]["SessionResponseDto"];
export const GROUP_ID = "00000000-0000-4000-8000-000000000001";
export const ADMIN_ID = "00000000-0000-4000-8000-000000000002";

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function requireAdmin(session: Session) {
  if (session.role !== "ADMIN") throw new HttpError(403, "Acesso restrito ao administrador.");
}

export function requireId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, "Identificador inválido.");
  }
  return id;
}

export function fields(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new HttpError(400, "Dados inválidos.");
  }
  return value as Record<string, unknown>;
}

export function playerName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) throw new HttpError(400, "Nome inválido.");
  return value.trim();
}

export function integerRating(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10) throw new HttpError(400, "Use uma nota inteira de 0 a 10.");
  return value;
}
