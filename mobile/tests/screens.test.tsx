import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { components } from '@futeio/contracts';
import { LoginScreen } from '../src/features/access/login-screen';
import { RosterScreen } from '../src/features/players/roster-screen';
import { ProfileScreen } from '../src/features/players/profile-screen';
import { useAuth } from '../src/providers/auth-provider';
import { apiRequest } from '../src/lib/api';
import { getApiConfigurationError } from '../src/lib/config';

jest.mock('../src/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../src/lib/config', () => ({ getApiConfigurationError: jest.fn(() => null) }));
jest.mock('../src/features/players/photo-selection', () => ({ selectProfilePhoto: jest.fn() }));
jest.mock('expo-router', () => ({ Redirect: () => null, useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual<typeof import('react-native')>('react-native').View, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

const mockAuth = jest.mocked(useAuth);
const mockRequest = jest.mocked(apiRequest);
const signIn = jest.fn<ReturnType<ReturnType<typeof useAuth>['signIn']>, Parameters<ReturnType<typeof useAuth>['signIn']>>();
const redeemLink = jest.fn<ReturnType<ReturnType<typeof useAuth>['redeemLink']>, Parameters<ReturnType<typeof useAuth>['redeemLink']>>();
const signOut = jest.fn<Promise<void>, []>();
const retry = jest.fn<Promise<void>, []>();
let client: QueryClient;

beforeEach(() => {
  // React's async act must keep its real microtask queue while userEvent
  // advances the native press/typing timers deterministically.
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  jest.clearAllMocks();
  jest.mocked(getApiConfigurationError).mockReturnValue(null);
  signIn.mockResolvedValue(undefined); redeemLink.mockResolvedValue(undefined); signOut.mockResolvedValue(undefined); retry.mockResolvedValue(undefined);
  mockAuth.mockReturnValue({ status: 'anonymous', session: null, error: null, signIn, redeemLink, signOut, retry });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
});
afterEach(() => { client.clear(); jest.useRealTimers(); });

it('requires the player link before attempting authentication', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<LoginScreen />);
  await user.press(screen.getByRole('button', { name: 'Entrar' }));
  expect(screen.getByText('Cole o link pessoal enviado pelo administrador.')).toBeOnTheScreen();
  expect(redeemLink).not.toHaveBeenCalled();
});

it('explains missing environment configuration before attempting authentication', async () => {
  jest.mocked(getApiConfigurationError).mockReturnValue('Configure mobile/.env antes de conectar à API.');
  await render(<LoginScreen />);
  expect(screen.getByText('Configure mobile/.env antes de conectar à API.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  expect(redeemLink).not.toHaveBeenCalled();
});

it('logs in the administrator and clears the password after the attempt', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<LoginScreen />);
  await user.press(screen.getByRole('button', { name: 'Sou administrador' }));
  await user.type(screen.getByLabelText('E-mail'), 'admin@example.test');
  await user.type(screen.getByLabelText('Senha'), 'synthetic-password');
  await user.press(screen.getByRole('button', { name: 'Entrar' }));
  expect(signIn).toHaveBeenCalledWith('admin@example.test', 'synthetic-password');
  expect(screen.getByLabelText('Senha')).toHaveProp('value', '');
});

it('passes the personal link to authentication without retaining it in the form', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<LoginScreen />);
  const link = 'https://example.test/acesso/jogador#synthetic-personal-link';
  await user.type(screen.getByLabelText('Link pessoal'), link);
  await user.press(screen.getByRole('button', { name: 'Entrar' }));
  expect(redeemLink).toHaveBeenCalledWith(link);
  expect(screen.getByLabelText('Link pessoal')).toHaveProp('value', '');
});

it('shows pending and existing evaluations and filters the roster by name', async () => {
  const players: components['schemas']['PlayerSummaryDto'][] = [
    { id: 'one', name: 'Ana', rating: 6.5, isOwnProfile: false, myRating: null },
    { id: 'two', name: 'Bruno', rating: 8, isOwnProfile: true, myRating: 9 },
  ];
  mockRequest.mockResolvedValue(players);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<QueryClientProvider client={client}><RosterScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('Avaliação pendente')).toBeOnTheScreen());
  expect(screen.getByText('Sua nota: 9')).toBeOnTheScreen();
  await user.type(screen.getByLabelText('Buscar jogador'), 'ANA');
  expect(screen.getByText('Ana')).toBeOnTheScreen();
  expect(screen.queryByText('Bruno · Você')).not.toBeOnTheScreen();
});

it('presents only the author names returned by the private profile contract', async () => {
  mockRequest.mockImplementation(async <T,>(requestPath: string): Promise<T> => (requestPath.endsWith('/evaluations') ? {
    rating: 6.5, evaluationCount: 2, discardedPerSide: 0, calculationVersion: 'trimmed-mean-v1',
    evaluations: [{ rating: 6, isOwn: false }, { rating: 7, isOwn: true, authorName: 'Ana' }],
  } : { id: 'one', name: 'Bruno', rating: 6.5, isOwnProfile: false, canEdit: false }) as T);
  await render(<QueryClientProvider client={client}><ProfileScreen id="one" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('Avaliação anônima')).toBeOnTheScreen());
  expect(screen.getByText('Você · Ana')).toBeOnTheScreen();
});
