import { waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { NativeApiClient } from '../src/lib/api';
import { SessionController, type Session } from '../src/lib/session-controller';
import { sessionStore, type SessionStore } from '../src/lib/session-store';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));

const token = 'S'.repeat(43);
const playerToken = 'P'.repeat(43);
const originalWeb = process.env.EXPO_PUBLIC_WEB_URL;
const session: Session = { role: 'PLAYER', identityId: 'identity-fixture', groupId: 'group-fixture', playerId: 'player-fixture' };
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function setup(saved: string | null = null) {
  let stored = saved;
  const store: jest.Mocked<SessionStore> = {
    read: jest.fn(async () => stored),
    write: jest.fn(async value => { stored = value; }),
    remove: jest.fn(async () => { stored = null; }),
  };
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  const api = new NativeApiClient(() => 'https://api.example.test/api/v1', fetchMock);
  const clearPrivateData = jest.fn();
  const controller = new SessionController(api, store, clearPrivateData);
  controller.connect();
  return { controller, store, api, fetchMock, clearPrivateData, readStored: () => stored };
}

beforeEach(() => { process.env.EXPO_PUBLIC_WEB_URL = 'https://web.example.test'; });
afterAll(() => {
  if (originalWeb === undefined) delete process.env.EXPO_PUBLIC_WEB_URL;
  else process.env.EXPO_PUBLIC_WEB_URL = originalWeb;
});

it('stores only the native session credential in device-bound SecureStore', async () => {
  await sessionStore.write(token);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('futeio.native-session.v1', token, {
    keychainService: 'com.futeio.session', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
});

it('verifies a restored session with the server before authenticating', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockResolvedValue(response(session));
  expect(fixture.controller.getSnapshot().status).toBe('loading');
  await fixture.controller.initialize();
  expect(fixture.fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/me', expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${token}` }) }));
  expect(fixture.controller.getSnapshot()).toEqual({ status: 'authenticated', session, error: null });
});

it('clears revoked credentials and private data after the server returns 401', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockResolvedValue(response({}, 401));
  await fixture.controller.initialize();
  await waitFor(() => expect(fixture.controller.getSnapshot().status).toBe('anonymous'));
  expect(fixture.readStored()).toBeNull();
  expect(fixture.clearPrivateData).toHaveBeenCalled();
  expect(fixture.controller.getSnapshot().session).toBeNull();
});

it('does not authenticate a restored session while verification is offline', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockRejectedValue(new Error('offline'));
  await fixture.controller.initialize();
  expect(fixture.controller.getSnapshot().status).toBe('error');
  expect(fixture.controller.getSnapshot().session).toBeNull();
  expect(fixture.clearPrivateData).toHaveBeenCalled();
});

it('exchanges a personal link and persists only the returned session token', async () => {
  const fixture = setup();
  fixture.fetchMock.mockResolvedValue(response({ token, session }));
  await fixture.controller.redeemLink(`https://web.example.test/acesso/jogador#token=${playerToken}`);
  expect(fixture.fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/native/player/redeem', expect.objectContaining({ body: JSON.stringify({ token: playerToken }) }));
  expect(fixture.store.write).toHaveBeenCalledWith(token);
  expect(fixture.store.write).not.toHaveBeenCalledWith(playerToken);
  expect(fixture.readStored()).toBe(token);
  expect(fixture.controller.getSnapshot().status).toBe('authenticated');
});

it('does not authenticate or persist a session after a failed login', async () => {
  const fixture = setup();
  fixture.fetchMock.mockRejectedValue(new Error('offline'));
  await expect(fixture.controller.signIn('admin@example.test', 'synthetic-password')).rejects.toThrow();
  expect(fixture.controller.getSnapshot().status).toBe('anonymous');
  expect(fixture.store.write).not.toHaveBeenCalled();
  expect(fixture.clearPrivateData).toHaveBeenCalled();
});

it('clears local credentials and private data even when server logout is offline', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockResolvedValueOnce(response(session));
  await fixture.controller.initialize();
  fixture.fetchMock.mockRejectedValueOnce(new Error('offline'));
  await fixture.controller.signOut();
  expect(fixture.readStored()).toBeNull();
  expect(fixture.clearPrivateData).toHaveBeenCalled();
  expect(fixture.controller.getSnapshot()).toEqual({ status: 'anonymous', session: null, error: expect.stringContaining('Sem conexão') });
});

it('does not let a late successful sign-in overwrite a subsequent logout', async () => {
  const fixture = setup();
  let resolve!: (value: Response) => void;
  fixture.fetchMock.mockReturnValue(new Promise(done => { resolve = done; }));
  const signIn = fixture.controller.signIn('admin@example.test', 'synthetic-password');
  await waitFor(() => expect(fixture.fetchMock).toHaveBeenCalledTimes(1));
  await fixture.controller.signOut();
  resolve(response({ token, session }));
  await signIn;
  expect(fixture.readStored()).toBeNull();
  expect(fixture.store.write).not.toHaveBeenCalled();
  expect(fixture.controller.getSnapshot().status).toBe('anonymous');
});

it('does not authenticate if secure credential storage fails', async () => {
  const fixture = setup();
  fixture.fetchMock.mockResolvedValue(response({ token, session }));
  fixture.store.write.mockRejectedValue(new Error('device locked'));
  await expect(fixture.controller.signIn('admin@example.test', 'synthetic-password')).rejects.toThrow();
  expect(fixture.controller.getSnapshot().status).toBe('anonymous');
  expect(fixture.controller.getSnapshot().session).toBeNull();
});

it('does not let an old logout response erase a newer successful login', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockResolvedValueOnce(response(session));
  await fixture.controller.initialize();
  let finishLogout!: (value: Response) => void;
  fixture.fetchMock.mockReturnValueOnce(new Promise(done => { finishLogout = done; }));
  const signOut = fixture.controller.signOut();
  await waitFor(() => expect(fixture.fetchMock).toHaveBeenCalledTimes(2));
  const replacementToken = 'N'.repeat(43);
  const replacementSession: Session = { ...session, identityId: 'replacement-identity' };
  fixture.fetchMock.mockResolvedValueOnce(response({ token: replacementToken, session: replacementSession }));
  await fixture.controller.signIn('admin@example.test', 'synthetic-password');
  finishLogout(response(undefined, 204));
  await signOut;
  expect(fixture.readStored()).toBe(replacementToken);
  expect(fixture.controller.getSnapshot()).toEqual({ status: 'authenticated', session: replacementSession, error: null });
});

it('keeps a replacement login after an older expiry finishes secure storage removal', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockResolvedValueOnce(response(session));
  await fixture.controller.initialize();
  let finishRemoval!: () => void;
  const remove = fixture.store.remove.getMockImplementation()!;
  fixture.store.remove.mockImplementationOnce(async () => {
    await new Promise<void>(done => { finishRemoval = done; });
    await remove();
  });
  fixture.api.onUnauthorized?.();
  await waitFor(() => expect(fixture.store.remove).toHaveBeenCalledTimes(1));
  const replacementToken = 'R'.repeat(43);
  const replacementSession: Session = { ...session, identityId: 'replacement-identity' };
  fixture.fetchMock.mockResolvedValueOnce(response({ token: replacementToken, session: replacementSession }));
  const signIn = fixture.controller.signIn('admin@example.test', 'synthetic-password');
  finishRemoval();
  await signIn;
  expect(fixture.readStored()).toBe(replacementToken);
  expect(fixture.controller.getSnapshot()).toEqual({ status: 'authenticated', session: replacementSession, error: null });
  fixture.fetchMock.mockResolvedValueOnce(response(replacementSession));
  await fixture.controller.initialize();
  expect(fixture.readStored()).toBe(replacementToken);
  expect(fixture.controller.getSnapshot()).toEqual({ status: 'authenticated', session: replacementSession, error: null });
});

it('rejects invalid stored credentials without contacting the API', async () => {
  const fixture = setup('not-a-native-session');
  await fixture.controller.initialize();
  expect(fixture.readStored()).toBeNull();
  expect(fixture.fetchMock).not.toHaveBeenCalled();
  expect(fixture.controller.getSnapshot().status).toBe('anonymous');
});

it('revalidates quietly while a native picker is open without unmounting authenticated content', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockResolvedValueOnce(response(session));
  await fixture.controller.initialize();
  let complete!: (value: Response) => void;
  fixture.fetchMock.mockReturnValueOnce(new Promise(done => { complete = done; }));
  const validation = fixture.controller.revalidate();
  await waitFor(() => expect(fixture.fetchMock).toHaveBeenCalledTimes(2));
  expect(fixture.controller.getSnapshot()).toEqual({ status: 'authenticated', session, error: null });
  complete(response(session));
  await validation;
  expect(fixture.controller.getSnapshot().status).toBe('authenticated');
});

it('hides revoked content before asynchronous secure storage removal finishes', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockResolvedValueOnce(response(session));
  await fixture.controller.initialize();
  let remove!: () => void;
  fixture.store.remove.mockImplementationOnce(() => new Promise(done => { remove = done; }));
  fixture.fetchMock.mockResolvedValueOnce(response({}, 401));
  await fixture.controller.revalidate();
  await waitFor(() => expect(fixture.store.remove).toHaveBeenCalled());
  expect(fixture.controller.getSnapshot()).toEqual({ status: 'loading', session: null, error: null });
  remove();
  await waitFor(() => expect(fixture.controller.getSnapshot().status).toBe('anonymous'));
});

it('fails closed on an unexpected identity change during quiet validation', async () => {
  const fixture = setup(token);
  fixture.fetchMock.mockResolvedValueOnce(response(session));
  await fixture.controller.initialize();
  fixture.fetchMock.mockResolvedValueOnce(response({ ...session, identityId: 'different-identity' }));
  await fixture.controller.revalidate();
  expect(fixture.controller.getSnapshot().status).toBe('anonymous');
  expect(fixture.readStored()).toBeNull();
});
