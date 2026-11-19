import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { fromByteArray } from 'base64-js';
import { getWebOrigin } from './config';

export type BrowserGrant = { code: string; codeVerifier: string; state: string };
export class BrowserLoginError extends Error {}
export const NATIVE_CALLBACK = 'futeio://auth/callback';
const base64url = (value: string) => value.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

export function parseNativeCallback(value: string, state: string, codeVerifier: string): BrowserGrant {
  const url = new URL(value);
  const code = url.searchParams.get('code');
  if (url.protocol !== 'futeio:' || url.hostname !== 'auth' || url.pathname !== '/callback' || url.username || url.password || url.port || url.hash ||
      url.searchParams.get('state') !== state || [...url.searchParams.keys()].sort().join(',') !== 'code,state' || !code || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
    throw new BrowserLoginError('Não foi possível confirmar o retorno do acesso. Entre novamente pelo aplicativo.');
  }
  return { code, state, codeVerifier };
}

export async function administratorBrowserGrant(): Promise<BrowserGrant | null> {
  if (Constants.executionEnvironment === 'storeClient') throw new BrowserLoginError('Para entrar com Google, use uma versão instalada do Fute.io. No Expo Go, entre com e-mail e senha.');
  const codeVerifier = base64url(fromByteArray(await Crypto.getRandomBytesAsync(32)));
  const state = base64url(fromByteArray(await Crypto.getRandomBytesAsync(32)));
  const codeChallenge = base64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const url = new URL('/acesso/aplicativo', getWebOrigin());
  url.searchParams.set('codeChallenge', codeChallenge);
  url.searchParams.set('state', state);
  try {
    const result = await WebBrowser.openAuthSessionAsync(url.toString(), NATIVE_CALLBACK, { preferEphemeralSession: true });
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success') throw new BrowserLoginError('O navegador não concluiu o acesso. Tente novamente.');
    return parseNativeCallback(result.url, state, codeVerifier);
  } catch (error) {
    if (error instanceof BrowserLoginError) throw error;
    throw new BrowserLoginError('Não foi possível abrir o acesso seguro. Tente novamente ou entre com e-mail e senha.');
  }
}
