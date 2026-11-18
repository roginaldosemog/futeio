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

export async function loginAdministratorWithGoogle(idToken: string): Promise<SessionResponse> {
  const input: components["schemas"]["AdminGoogleLoginDto"] = { idToken };
  const response = await apiMutation("auth/admin/google", input);
  return response.json();
}

export function googleLoginErrorMessage(error: unknown) {
  if (error instanceof AccessError) {
    if (error.status === 401 || error.status === 403) return "Esta conta Google não tem acesso à administração.";
    if (error.status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "auth/popup-blocked") return "Permita a janela de login do Google e tente novamente.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Login cancelado. Tente novamente quando quiser.";
  return "Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.";
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
