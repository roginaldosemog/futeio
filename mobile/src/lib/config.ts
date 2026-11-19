function configuredUrl(value: string | undefined, api: boolean): URL {
  if (!value) throw new Error('Configure mobile/.env antes de conectar à API.');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(typeof __DEV__ !== 'undefined' && __DEV__ && local && url.protocol === 'http:')) {
    throw new Error('Use um endereço HTTPS para conectar o celular.');
  }
  if (url.username || url.password || url.search || url.hash || url.hostname.endsWith('.invalid')) {
    throw new Error('Configure endereços válidos em mobile/.env.');
  }
  if (api ? url.pathname.replace(/\/$/, '') !== '/api/v1' : url.pathname !== '/') {
    throw new Error('A API deve terminar em /api/v1 e o endereço web deve conter apenas a origem.');
  }
  return url;
}

export function getApiBaseUrl(): string {
  return configuredUrl(process.env.EXPO_PUBLIC_API_URL, true).toString().replace(/\/$/, '');
}

export function getApiOrigin(): string { return new URL(getApiBaseUrl()).origin; }
export function getWebOrigin(): string { return configuredUrl(process.env.EXPO_PUBLIC_WEB_URL, false).origin; }

export function getApiConfigurationError(): string | null {
  try { getApiBaseUrl(); getWebOrigin(); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Confira mobile/.env.'; }
}

// Personal links are credentials: accept only the configured website and the
// exact backend-generated format. Never navigate to the supplied URL.
export function playerTokenFromLink(value: string): string {
  const url = new URL(value.trim());
  const fragment = new URLSearchParams(url.hash.slice(1));
  const token = fragment.get('token');
  if (url.origin !== getWebOrigin() || url.pathname !== '/acesso/jogador' || url.username || url.password || url.search ||
      [...fragment.keys()].length !== 1 || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error('Use o link pessoal enviado pelo administrador desta pelada.');
  }
  return token;
}
