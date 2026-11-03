import { createPlayer, listPlayers } from "./players-client";

const fetchMock = jest.fn();
const previousFetch = globalThis.fetch;
const player = { id: "player-id", name: "Colega", rating: 7, isOwnProfile: false };
function response(body: unknown, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => body }; }
beforeEach(() => { fetchMock.mockReset(); globalThis.fetch = fetchMock; });
afterAll(() => { globalThis.fetch = previousFetch; });

describe("players client", () => {
  it("reads the roster without caching private data and propagates cancellation", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(response([player]));
    await expect(listPlayers(controller.signal)).resolves.toEqual([player]);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/players", {
      signal: controller.signal, credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" },
    });
  });
  it("obtains fresh CSRF protection before sending only the creation fields", async () => {
    const result = { player, accessUrl: "https://futeio.example.test/acesso/jogador#token=fixture-secret" };
    fetchMock.mockResolvedValueOnce(response({ csrfToken: "fixture-csrf" })).mockResolvedValueOnce(response(result, 201));
    const input = { name: "Colega", initialRating: 7, linkToCurrentAdministrator: false };
    await expect(createPlayer(input)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/auth/csrf", expect.objectContaining({ credentials: "same-origin", cache: "no-store" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/players", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json", "x-csrf-token": "fixture-csrf" },
      body: JSON.stringify(input),
    });
  });
  it("does not repeat a rejected creation request or expose the raw server response", async () => {
    fetchMock.mockResolvedValueOnce(response({ csrfToken: "fixture-csrf" })).mockResolvedValueOnce(response({ details: "private backend details" }, 503));
    await expect(createPlayer({ name: "Colega", initialRating: 7 })).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
