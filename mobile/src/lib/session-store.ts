import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './config';

const key = 'futeio.native-session.v2';
const legacyKey = 'futeio.native-session.v1';
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'com.futeio.session',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface SessionStore {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  remove(): Promise<void>;
}

export const sessionStore: SessionStore = {
  async read() {
    // Legacy credentials belonged to the archived API; never forward them.
    await SecureStore.deleteItemAsync(legacyKey, options);
    const value = await SecureStore.getItemAsync(key, options);
    if (!value) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { parsed = null; }
    if (parsed && typeof parsed === 'object' && 'api' in parsed && parsed.api === getApiBaseUrl() && 'token' in parsed && typeof parsed.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(parsed.token)) return parsed.token;
    await SecureStore.deleteItemAsync(key, options);
    return null;
  },
  write: (token) => SecureStore.setItemAsync(key, JSON.stringify({ api: getApiBaseUrl(), token }), options),
  async remove() {
    await SecureStore.deleteItemAsync(key, options);
    await SecureStore.deleteItemAsync(legacyKey, options);
  },
};
