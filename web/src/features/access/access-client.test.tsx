import { AccessError, currentSession, loginAdministrator, loginErrorMessage, logout } from "./access-client";

const fetchMock = jest.fn();
const previousFetch = globalThis.fetch;
const session = { role: "ADMIN", identityId: "test-identity", groupId: "test-group", email: "admin@example.com" };

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

afterAll(() => {
  globalThis.fetch = previousFetch;
});

describe("access client", () => {
  it("obtains CSRF protection before sending login credentials without a client-selected role", async () => {
    fetchMock.mockResolvedValueOnce(response({ csrfToken: "test-csrf" })).mockResolvedValueOnce(response(session));

    await expect(loginAdministrator("admin@example.com", "senha-exclusiva-do-teste")).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/auth/csrf", {
      credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/auth/admin/login", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json", "x-csrf-token": "test-csrf" },
      body: JSON.stringify({ email: "admin@example.com", password: "senha-exclusiva-do-teste" }),
    });
  });

  it("never submits credentials when CSRF protection cannot be established", async () => {
    fetchMock.mockResolvedValueOnce(response({}));
    await expect(loginAdministrator("admin@example.com", "senha-exclusiva-do-teste")).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads the current session without caching it and supports cancellation", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(response(session));
    await expect(currentSession(controller.signal)).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/me", {
      signal: controller.signal, credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" },
    });
  });

  it("protects logout with a fresh CSRF request and sends an empty body", async () => {
    fetchMock.mockResolvedValueOnce(response({ csrfToken: "test-csrf" })).mockResolvedValueOnce(response({ message: "ok" }));
    await logout();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/auth/logout", expect.objectContaining({
      method: "POST", body: "{}", credentials: "same-origin", cache: "no-store",
      headers: expect.objectContaining({ "x-csrf-token": "test-csrf" }),
    }));
  });

  it.each([
    [401, "E-mail ou senha inválidos."],
    [429, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
    [503, "Não foi possível entrar agora. Tente novamente em instantes."],
  ])("turns HTTP %i into a safe, actionable login error", (status, message) => {
    expect(loginErrorMessage(new AccessError(status))).toBe(message);
  });

  it("does not expose network error details", () => {
    expect(loginErrorMessage(new Error("internal connection details"))).toBe("Não foi possível entrar agora. Tente novamente em instantes.");
  });
});
