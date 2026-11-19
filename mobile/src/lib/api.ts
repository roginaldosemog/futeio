import { fetch as expoFetch } from 'expo/fetch';
import { fromByteArray } from 'base64-js';
import { getApiBaseUrl } from './config';

export class AccessError extends Error {
  constructor(public readonly status: number) {
    super('Não foi possível concluir a solicitação.');
    this.name = 'AccessError';
  }
}

export type RequestOptions = { method?: 'GET' | 'POST' | 'DELETE'; body?: object; signal?: AbortSignal };
type Fetcher = typeof globalThis.fetch;

export class NativeApiClient {
  private token: string | null = null;
  private revision = 0;
  onUnauthorized: (() => void) | null = null;

  constructor(private readonly baseUrl: () => string, private readonly fetcher: Fetcher) {}

  setToken(token: string | null) {
    if (token === this.token) return;
    this.token = token;
    this.revision++;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.send<T>(path, options, this.token, this.revision);
  }

  async authenticate<T>(path: string, body: object): Promise<T> {
    return this.send<T>(path, { method: 'POST', body }, null, -1);
  }

  async privatePhoto(value: string, signal?: AbortSignal): Promise<string> {
    const base = new URL(this.baseUrl());
    const url = new URL(value, base);
    if (url.origin !== base.origin || url.username || url.password || url.search || url.hash ||
        !/^\/api\/v1\/players\/[0-9a-f-]{36}\/photo$/i.test(url.pathname)) {
      throw new Error('Endereço de foto inválido.');
    }
    return this.send(url.pathname.slice('/api/v1/'.length), { signal }, this.token, this.revision, async (response) => {
      const max = 2 * 1024 * 1024;
      if (response.headers.get('content-type')?.split(';')[0] !== 'image/jpeg' ||
          Number(response.headers.get('content-length') ?? 0) > max) throw new AccessError(502);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > max) throw new AccessError(502);
      // Fetch with the same strict credential/redirect policy as JSON. The
      // native Image receives bytes in memory, never a bearer or remote URL.
      return `data:image/jpeg;base64,${fromByteArray(bytes)}`;
    });
  }

  revokeSession(): Promise<void> {
    const token = this.token;
    this.setToken(null);
    return token ? this.send('auth/logout', { method: 'POST', body: {} }, token, -1) : Promise.resolve();
  }

  private async send<T>(path: string, options: RequestOptions, token: string | null, revision: number, decode?: (response: Response) => Promise<T>): Promise<T> {
    if (!/^[a-zA-Z0-9_/-]+$/.test(path) || path.startsWith('/') || path.includes('..')) throw new Error('Caminho de API inválido.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15_000);
    try {
      const response = await this.fetcher(`${this.baseUrl()}/${path}`, {
        method: options.method ?? 'GET',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: decode ? 'image/jpeg' : 'application/json',
          'X-Futeio-Client': 'native',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
      if (!response.ok) {
        // A late 401 from a previous session must not terminate its replacement.
        if (response.status === 401 && token && revision === this.revision) this.onUnauthorized?.();
        throw new AccessError(response.status);
      }
      if (decode) return await decode(response);
      if (response.status === 204) return undefined as T;
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
}

export const nativeApi = new NativeApiClient(getApiBaseUrl, expoFetch as Fetcher);
export const apiRequest = <T>(path: string, options?: RequestOptions): Promise<T> => nativeApi.request<T>(path, options);
export const privatePhoto = (url: string, signal?: AbortSignal): Promise<string> => nativeApi.privatePhoto(url, signal);
