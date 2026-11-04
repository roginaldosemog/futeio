import { fetch as expoFetch } from 'expo/fetch';
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

  setToken(token: string | null) { this.token = token; this.revision++; }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.send<T>(path, options, this.token, this.revision);
  }

  async authenticate<T>(path: string, body: object): Promise<T> {
    return this.send<T>(path, { method: 'POST', body }, null, -1);
  }

  revokeSession(): Promise<void> {
    const token = this.token;
    this.setToken(null);
    return token ? this.send('auth/logout', { method: 'POST', body: {} }, token, -1) : Promise.resolve();
  }

  private async send<T>(path: string, options: RequestOptions, token: string | null, revision: number): Promise<T> {
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
          Accept: 'application/json',
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
