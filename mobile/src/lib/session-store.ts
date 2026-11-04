import * as SecureStore from 'expo-secure-store';

const key = 'futeio.native-session.v1';
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
  read: () => SecureStore.getItemAsync(key, options),
  write: (token) => SecureStore.setItemAsync(key, token, options),
  remove: () => SecureStore.deleteItemAsync(key, options),
};
