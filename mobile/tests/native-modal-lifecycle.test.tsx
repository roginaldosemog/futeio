import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';
import { AppProviders } from '../src/providers/app-providers';
import { ProfileScreen } from '../src/features/players/profile-screen';
import { nativeApi, AccessError } from '../src/lib/api';
import { selectProfilePhoto } from '../src/features/players/photo-selection';
import { useAuth } from '../src/providers/auth-provider';

jest.mock('../src/lib/api', () => {
  const nativeApi = { request: jest.fn(), authenticate: jest.fn(), setToken: jest.fn(), revokeSession: jest.fn(), onUnauthorized: null };
  return { nativeApi, apiRequest: (...args: unknown[]) => nativeApi.request(...args), privatePhoto: jest.fn(), AccessError: class extends Error { status: number; constructor(code: number) { super('request failed'); this.status = code; } } };
});
jest.mock('../src/lib/session-store', () => ({ sessionStore: { read: async () => 'S'.repeat(43), write: jest.fn(), remove: jest.fn() } }));
jest.mock('../src/features/players/photo-selection', () => ({ selectProfilePhoto: jest.fn() }));
jest.mock('expo-network', () => ({ addNetworkStateListener: () => ({ remove: jest.fn() }), getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: jest.requireActual<typeof import('react-native')>('react-native').View }));

const session = { role: 'PLAYER', identityId: 'identity', groupId: 'group', playerId: 'player' };
const profile = { id: 'player', name: 'Ana', isOwnProfile: true, canEdit: true, rating: 7 };
const evaluations = { rating: 7, evaluationCount: 1, discardedPerSide: 0, calculationVersion: 'v1', evaluations: [{ isOwn: true, rating: 7 }] };
const request = jest.mocked(nativeApi.request);
let appState: (state: AppStateStatus) => void;
const initialStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { appState = listener; return { remove: jest.fn() }; });
});
afterEach(() => { focusManager.setFocused(true); jest.useRealTimers(); });
afterAll(() => { if (initialStateDescriptor) Object.defineProperty(AppState, 'currentState', initialStateDescriptor); });

function PrivateProfile() {
  const auth = useAuth();
  return auth.status === 'authenticated' ? <ProfileScreen id="player" /> : <Text>Verificando acesso...</Text>;
}

it.each([false, true])('preserves a pending picker after native resume, including a transient profile refresh failure (%s)', async transientFailure => {
  let authCalls = 0;
  let profileCalls = 0;
  let validate!: (value: typeof session) => void;
  let picked!: (value: string) => void;
  request.mockImplementation(async <T,>(path: string): Promise<T> => {
    if (path === 'auth/me') {
      authCalls++;
      return (authCalls === 1 ? session : await new Promise<typeof session>(done => { validate = done; })) as T;
    }
    if (path.endsWith('/evaluations')) return evaluations as T;
    if (path.endsWith('/photo')) return profile as T;
    profileCalls++;
    if (transientFailure && profileCalls > 1) throw new AccessError(503);
    return profile as T;
  });
  jest.mocked(selectProfilePhoto).mockImplementationOnce(() => new Promise(done => { picked = done; }));
  await render(<AppProviders><PrivateProfile /></AppProviders>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Escolher foto' })).toBeOnTheScreen());
  await fireEvent.changeText(screen.getByLabelText('Nome do jogador'), 'Nome ainda não salvo');
  await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto' }));
  await act(async () => { appState('inactive'); appState('active'); });
  await waitFor(() => expect(authCalls).toBe(2));
  await act(async () => { validate(session); });
  await waitFor(() => expect(screen.getByLabelText('Nome do jogador')).toHaveProp('value', 'Nome ainda não salvo'));
  if (transientFailure) await waitFor(() => expect(screen.getByText(/Exibindo os últimos dados confirmados/)).toBeOnTheScreen());
  await act(async () => { picked('processed-jpeg'); });
  await waitFor(() => expect(request).toHaveBeenCalledWith('players/player/photo', { method: 'POST', body: { data: 'processed-jpeg' } }));
  expect(screen.getByText('Foto salva.')).toBeOnTheScreen();
});
