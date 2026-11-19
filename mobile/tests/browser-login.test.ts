import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { administratorBrowserGrant, NATIVE_CALLBACK, parseNativeCallback } from '../src/lib/browser-login';

jest.mock('expo-crypto', () => ({ getRandomBytesAsync: jest.fn(), digestStringAsync: jest.fn(), CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, CryptoEncoding: { BASE64: 'base64' } }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn(), WebBrowserResultType: { CANCEL: 'cancel' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'bare' } }));
const state = 'S'.repeat(43);
const code = 'C'.repeat(43);
const verifier = 'V'.repeat(43);
const previousWeb = process.env.EXPO_PUBLIC_WEB_URL;
beforeEach(() => {
  process.env.EXPO_PUBLIC_WEB_URL = 'https://web.example.test';
  Object.assign(Constants, { executionEnvironment: 'bare' });
  jest.mocked(Crypto.getRandomBytesAsync).mockResolvedValue(new Uint8Array(32));
  jest.mocked(Crypto.digestStringAsync).mockResolvedValue('D'.repeat(43) + '=');
});
afterAll(() => { if (previousWeb === undefined) delete process.env.EXPO_PUBLIC_WEB_URL; else process.env.EXPO_PUBLIC_WEB_URL = previousWeb; });

it('accepts only the fixed callback and matching state without duplicate parameters', () => {
  expect(parseNativeCallback(`${NATIVE_CALLBACK}?code=${code}&state=${state}`, state, verifier)).toEqual({ code, state, codeVerifier: verifier });
  for (const value of [
    `https://attacker.example/auth/callback?code=${code}&state=${state}`,
    `futeio://other/callback?code=${code}&state=${state}`,
    `${NATIVE_CALLBACK}?code=${code}&state=wrong`,
    `${NATIVE_CALLBACK}?code=${code}&state=${state}&state=${state}`,
    `${NATIVE_CALLBACK}?code=${code}&state=${state}#fragment`,
  ]) expect(() => parseNativeCallback(value, state, verifier)).toThrow();
});

it('keeps verifier out of the browser URL and binds the returned authorization code', async () => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockImplementation(async url => {
    const opened = new URL(url);
    expect(opened.origin).toBe('https://web.example.test');
    expect(opened.pathname).toBe('/acesso/aplicativo');
    expect([...opened.searchParams.keys()].sort()).toEqual(['codeChallenge', 'state']);
    expect(opened.searchParams.has('codeVerifier')).toBe(false);
    return { type: 'success', url: `${NATIVE_CALLBACK}?code=${code}&state=${opened.searchParams.get('state')}` };
  });
  const result = await administratorBrowserGrant();
  expect(result?.code).toBe(code);
  expect(result?.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(result?.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', result?.codeVerifier, { encoding: 'base64' });
  expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(expect.any(String), NATIVE_CALLBACK, { preferEphemeralSession: true });
});

it('treats cancellation as cancellation and explains the Expo Go limitation', async () => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
  expect(await administratorBrowserGrant()).toBeNull();
  Object.assign(Constants, { executionEnvironment: 'storeClient' });
  await expect(administratorBrowserGrant()).rejects.toThrow('No Expo Go, entre com e-mail e senha');
});
