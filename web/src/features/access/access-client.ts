import type { components } from "@/generated/api-types";
import { AccessError, apiMutation, apiRequest } from "@/lib/api-client";

export { AccessError } from "@/lib/api-client";

export type SessionResponse = components["schemas"]["SessionResponseDto"];
type AdminPasswordLogin = components["schemas"]["AdminPasswordLoginDto"];

export async function loginAdministrator(email: string, password: string): Promise<SessionResponse> {
  const input: AdminPasswordLogin = { email, password };
  const response = await apiMutation("auth/admin/login", input);
  return response.json();
}

export async function currentSession(signal?: AbortSignal): Promise<SessionResponse> {
  const response = await apiRequest("auth/me", { signal });
  return response.json();
}

export async function logout() {
  await apiMutation("auth/logout", {});
}

export function loginErrorMessage(error: unknown) {
  if (error instanceof AccessError) {
    if (error.status === 401) return "E-mail ou senha inválidos.";
    if (error.status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  return "Não foi possível entrar agora. Tente novamente em instantes.";
}
