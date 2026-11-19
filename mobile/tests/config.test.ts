import { getApiBaseUrl, getApiConfigurationError, getWebOrigin, playerTokenFromLink } from '../src/lib/config';

const token = 'A'.repeat(43);
const originalApi = process.env.EXPO_PUBLIC_API_URL;
const originalWeb = process.env.EXPO_PUBLIC_WEB_URL;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1';
  process.env.EXPO_PUBLIC_WEB_URL = 'https://web.example.test';
});
afterAll(() => {
  if (originalApi === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalApi;
  if (originalWeb === undefined) delete process.env.EXPO_PUBLIC_WEB_URL;
  else process.env.EXPO_PUBLIC_WEB_URL = originalWeb;
});

it('normalizes the configured HTTPS API and website', () => {
  process.env.EXPO_PUBLIC_API_URL += '/';
  expect(getApiBaseUrl()).toBe('https://api.example.test/api/v1');
  expect(getWebOrigin()).toBe('https://web.example.test');
  expect(getApiConfigurationError()).toBeNull();
});

it.each([
  undefined,
  'http://api.example.test/api/v1',
  'https://user:password@api.example.test/api/v1',
  'https://api.example.test/api/v1?token=credential',
  'https://api.example.test/api/v1#credential',
  'https://api.example.test/api',
  'https://replace-me.invalid/api/v1',
])('rejects an unsafe or incomplete API configuration: %s', value => {
  process.env.EXPO_PUBLIC_API_URL = value;
  if (value === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  expect(() => getApiBaseUrl()).toThrow();
  expect(getApiConfigurationError()).not.toBeNull();
});

it('accepts only the configured website and exact personal link shape', () => {
  expect(playerTokenFromLink(`  https://web.example.test/acesso/jogador#token=${token}  `)).toBe(token);
});

it.each([
  `https://attacker.test/acesso/jogador#token=${token}`,
  `https://web.example.test.attacker.test/acesso/jogador#token=${token}`,
  `https://user:password@web.example.test/acesso/jogador#token=${token}`,
  `https://web.example.test/other#token=${token}`,
  `https://web.example.test/acesso/jogador/?token=${token}`,
  `https://web.example.test/acesso/jogador?token=${token}`,
  `https://web.example.test/acesso/jogador?extra=1#token=${token}`,
  `https://web.example.test/acesso/jogador#token=${token}&extra=1`,
  `https://web.example.test/acesso/jogador#token=${token}&token=${token}`,
  'https://web.example.test/acesso/jogador#token=short',
  `https://web.example.test/acesso/jogador#token=${'!'.repeat(43)}`,
  token,
])('rejects a personal link outside the configured credential format', value => {
  expect(() => playerTokenFromLink(value)).toThrow();
});

it('rejects web configuration containing a path', () => {
  process.env.EXPO_PUBLIC_WEB_URL = 'https://web.example.test/other';
  expect(() => getWebOrigin()).toThrow();
});

it('allows HTTP only for loopback development and rejects it in production', () => {
  const environment = globalThis as typeof globalThis & { __DEV__: boolean };
  const previous = environment.__DEV__;
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3001/api/v1';
  try {
    environment.__DEV__ = true;
    expect(getApiBaseUrl()).toBe('http://127.0.0.1:3001/api/v1');
    environment.__DEV__ = false;
    expect(() => getApiBaseUrl()).toThrow();
  } finally { environment.__DEV__ = previous; }
});
