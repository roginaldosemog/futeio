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

it('does not suppress a valid 401 merely because quiet validation restored the same credential', async () => {
  let resolve!: (value: Response) => void;
  const fetchMock = fetcher().mockReturnValue(new Promise(done => { resolve = done; }));
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  client.setToken('same-session');
  client.onUnauthorized = jest.fn();
  const pending = client.request('players');
  client.setToken('same-session');
  resolve(response({}, 401));
  await expect(pending).rejects.toEqual(new AccessError(401));
  expect(client.onUnauthorized).toHaveBeenCalledTimes(1);
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

const photoPath = '/api/v1/players/00000000-0000-4000-8000-000000000001/photo';
const jpeg = (bytes = new Uint8Array([255, 216, 255]), mime = 'image/jpeg', length?: string) => ({
  ok: true, status: 200,
  headers: { get: (key: string) => key === 'content-type' ? mime : key === 'content-length' ? length ?? null : null },
  arrayBuffer: async () => bytes.buffer,
}) as unknown as Response;

it.each([
  `https://other.example${photoPath}`, `https://user:password@api.example.test${photoPath}`,
  '/api/v1/players/other/photo', '/api/v1/auth/me', `${photoPath}?token=bad`, `${photoPath}#secret`,
])('rejects an untrusted private photo without sending credentials: %s', async value => {
  const fetchMock = fetcher();
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  client.setToken('photo-session');
  await expect(client.privatePhoto(value)).rejects.toThrow('Endereço de foto inválido.');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('returns only an in-memory image and keeps the strict bearer/redirect policy for private photos', async () => {
  const fetchMock = fetcher().mockResolvedValue(jpeg());
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  client.setToken('photo-session');
  expect(await client.privatePhoto(photoPath)).toBe('data:image/jpeg;base64,/9j/');
  expect(fetchMock).toHaveBeenCalledWith(`https://api.example.test${photoPath}`, expect.objectContaining({
    credentials: 'omit', redirect: 'error', headers: { Accept: 'image/jpeg', Authorization: 'Bearer photo-session' },
  }));
});

it('rejects non-JPEG private responses before consuming the body', async () => {
  const result = jpeg(undefined, 'text/html');
  result.arrayBuffer = jest.fn();
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetcher().mockResolvedValue(result));
  await expect(client.privatePhoto(photoPath)).rejects.toEqual(new AccessError(502));
  expect(result.arrayBuffer).not.toHaveBeenCalled();
});

it('bounds private photo sizes both with and without Content-Length', async () => {
  const fetchMock = fetcher().mockResolvedValueOnce(jpeg(undefined, 'image/jpeg', '2097153'))
    .mockResolvedValueOnce(jpeg(new Uint8Array(2 * 1024 * 1024 + 1)));
  const client = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  await expect(client.privatePhoto(photoPath)).rejects.toEqual(new AccessError(502));
  await expect(client.privatePhoto(photoPath)).rejects.toEqual(new AccessError(502));
});
