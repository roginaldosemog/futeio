import { fetch as expoFetch } from 'expo/fetch';
import { AccessError, NativeApiClient, apiRequest, nativeApi } from '../src/lib/api';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const fetcher = () => jest.fn<Promise<Response>, Parameters<typeof fetch>>();

afterEach(() => { jest.useRealTimers(); nativeApi.setToken(null); });

it('uses an explicit bearer and omits cookies, redirects, and browser Origin', async () => {
  const fetchMock = fetcher().mockResolvedValue(response({ ok: true }));
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  client.setToken('session-token');
  await client.request('players', { method: 'POST', body: { name: 'Synthetic' } });
  expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/players', expect.objectContaining({
    method: 'POST', credentials: 'omit', redirect: 'error',
    headers: { Accept: 'application/json', Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Synthetic' }),
  }));
});

it('uses expo/fetch for the application client without browser credentials', async () => {
  const previous = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1';
  jest.mocked(expoFetch).mockResolvedValue(response([]) as unknown as Awaited<ReturnType<typeof expoFetch>>);
  try {
    await apiRequest('players');
    expect(expoFetch).toHaveBeenCalledWith('https://api.example.test/api/v1/players', expect.objectContaining({ credentials: 'omit', redirect: 'error' }));
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previous;
  }
});

it('never sends the previous session while requesting native authentication', async () => {
  const fetchMock = fetcher().mockResolvedValue(response({ token: 'new-session' }));
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  client.setToken('old-session');
  await client.authenticate('auth/native/admin/login', { email: 'admin@example.test', password: 'synthetic' });
  expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
});

it('invalidates the active session on 401', async () => {
  const fetchMock = fetcher().mockResolvedValue(response({}, 401));
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  client.setToken('active-session');
  client.onUnauthorized = jest.fn();
  await expect(client.request('players')).rejects.toEqual(new AccessError(401));
  expect(client.onUnauthorized).toHaveBeenCalledTimes(1);
});

it('ignores an old 401 after a replacement session has been installed', async () => {
  let resolve!: (value: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  const fetchMock = fetcher().mockReturnValue(pending);
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  client.setToken('old-session');
  client.onUnauthorized = jest.fn();
  const request = client.request('players');
  client.setToken('replacement-session');
  resolve(response({}, 401));
  await expect(request).rejects.toEqual(new AccessError(401));
  expect(client.onUnauthorized).not.toHaveBeenCalled();
});

it('cancels the native request when the caller aborts', async () => {
  const fetchMock = fetcher().mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  const controller = new AbortController();
  const request = client.request('players', { signal: controller.signal });
  controller.abort();
  await expect(request).rejects.toThrow('aborted');
  expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});

it('bounds request duration without retrying a failed mutation', async () => {
  jest.useFakeTimers();
  const fetchMock = fetcher().mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  }));
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  const request = client.request('draws', { method: 'POST', body: { playerIds: [] } });
  const rejection = expect(request).rejects.toThrow('timeout');
  await jest.advanceTimersByTimeAsync(15_000);
  await rejection;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(['https://attacker.test', '/players', '../players', 'players?url=https://attacker.test'])('rejects an unsafe request path: %s', async path => {
  const fetchMock = fetcher();
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  await expect(client.request(path)).rejects.toThrow('Caminho de API inválido.');
  expect(fetchMock).not.toHaveBeenCalled();
});
