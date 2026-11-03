import type { components } from "@/generated/api-types";

export type SessionResponse = components["schemas"]["SessionResponseDto"];
type AdminPasswordLogin = components["schemas"]["AdminPasswordLoginDto"];
type CsrfResponse = components["schemas"]["CsrfResponseDto"];

export class AccessError extends Error {
  constructor(public readonly status: number) {
    super("The access request could not be completed.");
    this.name = "AccessError";
  }
}

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/v1/auth/${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", ...options.headers },
  });
  if (!response.ok) throw new AccessError(response.status);
  return response;
}

async function csrfToken(): Promise<CsrfResponse["csrfToken"]> {
  const response = await request("csrf");
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("csrfToken" in body) ||
    typeof body.csrfToken !== "string" ||
    !body.csrfToken
  ) {
    throw new AccessError(503);
  }
  return body.csrfToken;
}

async function mutate(path: string, body: object) {
  const token = await csrfToken();
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": token },
    body: JSON.stringify(body),
  });
}

export async function loginAdministrator(email: string, password: string): Promise<SessionResponse> {
  const input: AdminPasswordLogin = { email, password };
  const response = await mutate("admin/login", input);
  return response.json();
}

export async function currentSession(signal?: AbortSignal): Promise<SessionResponse> {
  const response = await request("me", { signal });
  return response.json();
}

export async function logout() {
  await mutate("logout", {});
}

export function loginErrorMessage(error: unknown) {
  if (error instanceof AccessError) {
    if (error.status === 401) return "E-mail ou senha inválidos.";
    if (error.status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  return "Não foi possível entrar agora. Tente novamente em instantes.";
}
