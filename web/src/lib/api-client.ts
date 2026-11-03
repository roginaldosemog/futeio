export class AccessError extends Error {
  constructor(public readonly status: number) {
    super("The access request could not be completed.");
    this.name = "AccessError";
  }
}

export async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/v1/${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", ...options.headers },
  });
  if (!response.ok) throw new AccessError(response.status);
  return response;
}

async function csrfToken(): Promise<string> {
  const response = await apiRequest("auth/csrf");
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("csrfToken" in body) || typeof body.csrfToken !== "string" || !body.csrfToken) {
    throw new AccessError(503);
  }
  return body.csrfToken;
}

export async function apiMutation(path: string, body: object) {
  const token = await csrfToken();
  return apiRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": token },
    body: JSON.stringify(body),
  });
}
