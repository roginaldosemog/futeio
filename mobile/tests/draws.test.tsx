import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DrawHistoryScreen } from '../src/features/draws/draw-history-screen';
import { DrawResultScreen } from '../src/features/draws/draw-result-screen';
import { DrawCreationScreen } from '../src/features/draws/draw-creation-screen';
import type { Draw, DrawParticipant } from '../src/features/draws/draws-client';
import { AccessError, apiRequest } from '../src/lib/api';
import { useAuth } from '../src/providers/auth-provider';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockBlur: (() => void) | undefined;
let mockFocus: (() => void | (() => void)) | undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      mockFocus = callback;
      const cleanup = callback();
      mockBlur = typeof cleanup === 'function' ? cleanup : undefined;
      return cleanup;
    }, [callback]);
  },
}));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../src/lib/api', () => ({ ...jest.requireActual<typeof import('../src/lib/api')>('../src/lib/api'), apiRequest: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const request = jest.mocked(apiRequest);
const auth = jest.mocked(useAuth);
let client: QueryClient;
const players: DrawParticipant[] = Array.from({ length: 21 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Jogador ${String(index + 1).padStart(2, '0')}`, rating: index % 11, isOwnProfile: false,
}));
const draw: Draw = {
  id: 'recorded-draw', createdAt: '2026-11-04T12:00:00.000Z', seed: 'recorded-seed',
  algorithmVersion: 'balanced-search-v1', calculationVersion: 'trimmed-mean-v1', spread: 0.5, variance: 0.125,
  teams: [{ number: 1, average: 6.1, total: 30.5, players: [{ id: 'snapshot-player', name: 'Nome na data do sorteio', rating: 6.1 }] }],
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  jest.clearAllMocks();
  mockBlur = undefined; mockFocus = undefined;
  auth.mockReturnValue({ status: 'authenticated', error: null, session: { role: 'ADMIN', groupId: 'group', identityId: 'admin' }, signIn: jest.fn(), signInWithGoogle: jest.fn(), redeemLink: jest.fn(), signOut: jest.fn(), retry: jest.fn() });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
});
afterEach(() => { client.clear(); onlineManager.setOnline(true); jest.useRealTimers(); });

async function creation() {
  request.mockResolvedValue(players);
  const result = await render(<QueryClientProvider client={client}><DrawCreationScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Jogador 01' })).toBeOnTheScreen());
  return result;
}
async function selectTwenty() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const boxes = screen.getAllByRole('checkbox').slice(0, 20);
  await act(async () => { for (const box of boxes) await fireEvent.press(box); });
  return user;
}

it('denies creating a draw to players without requesting a roster', async () => {
  auth.mockReturnValue({ ...auth(), status: 'authenticated', error: null, session: { role: 'PLAYER', groupId: 'group', identityId: 'player' } });
  await render(<QueryClientProvider client={client}><DrawCreationScreen /></QueryClientProvider>);
  expect(screen.getByText('Somente o administrador pode criar sorteios.')).toBeOnTheScreen();
  expect(request).not.toHaveBeenCalled();
});

it('requires exactly 20 distinct participants, limits the selection and allows clearing it', async () => {
  await creation();
  expect(screen.getByRole('button', { name: 'Sortear 4 times' })).toBeDisabled();
  const user = await selectTwenty();
  expect(screen.getByText('20 de 20 selecionados')).toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: 'Jogador 21' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sortear 4 times' })).toBeEnabled();
  await user.press(screen.getByRole('button', { name: 'Limpar seleção' }));
  expect(screen.getByText('0 de 20 selecionados')).toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: 'Jogador 21' })).toBeEnabled();
});

it('preserves selection while filtering the participants by name', async () => {
  await creation();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.press(screen.getByRole('checkbox', { name: 'Jogador 01' }));
  await user.type(screen.getByLabelText('Buscar participante'), 'Jogador 21');
  expect(screen.queryByRole('checkbox', { name: 'Jogador 01' })).not.toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: 'Jogador 21' })).toBeOnTheScreen();
  expect(screen.getByText('1 de 20 selecionados')).toBeOnTheScreen();
});

it('sends the selected IDs once and opens the confirmed server snapshot', async () => {
  await creation();
  const user = await selectTwenty();
  request.mockResolvedValue(draw);
  await user.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sorteios/[id]', params: { id: draw.id } }));
  const posts = request.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(posts).toEqual([['draws', { method: 'POST', body: { playerIds: players.slice(0, 20).map(player => player.id) } }]]);
});

it('ignores repeated taps while a draw response is still pending', async () => {
  await creation();
  await selectTwenty();
  let finish!: (value: Draw) => void;
  request.mockReturnValueOnce(new Promise<Draw>(resolve => { finish = resolve; }));
  const button = screen.getByRole('button', { name: 'Sortear 4 times' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Montando os times...' })).toBeDisabled());
  expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  finish(draw);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sorteios/[id]', params: { id: draw.id } }));
});

it.each([new Error('offline'), new AccessError(503), new AccessError(429)])('locks uncertain submission until the administrator explicitly opens history: %s', async failure => {
  await creation();
  const user = await selectTwenty();
  request.mockRejectedValue(failure);
  await user.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Conferir histórico' })).toBeOnTheScreen());
  expect(screen.getByRole('button', { name: 'Sortear 4 times' })).toBeDisabled();
  await user.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  await user.press(screen.getByRole('button', { name: 'Conferir histórico' }));
  expect(mockReplace).toHaveBeenCalledWith('/sorteios');
});

it('allows correcting a rejected participant selection and explicitly submitting it again', async () => {
  await creation();
  const user = await selectTwenty();
  request.mockRejectedValueOnce(new AccessError(400));
  await user.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  await waitFor(() => expect(screen.getByText('Confira a seleção: são necessários 20 jogadores distintos do grupo.')).toBeOnTheScreen());
  await user.press(screen.getByRole('checkbox', { name: 'Jogador 20' }));
  await user.press(screen.getByRole('checkbox', { name: 'Jogador 21' }));
  request.mockResolvedValueOnce(draw);
  await user.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sorteios/[id]', params: { id: draw.id } }));
  const posts = request.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(posts[1]).toEqual(['draws', { method: 'POST', body: { playerIds: [...players.slice(0, 19).map(player => player.id), players[20]!.id] } }]);
});

it('opens recorded draws from the history and explains the 50-entry limit', async () => {
  request.mockResolvedValue([draw]);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<QueryClientProvider client={client}><DrawHistoryScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: /Abrir sorteio de/ })).toBeOnTheScreen());
  expect(screen.getByText(/50 sorteios mais recentes/)).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: /Abrir sorteio de/ }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/sorteios/[id]', params: { id: draw.id } });
});

it('renders only the recorded result without querying or recomputing current player ratings', async () => {
  request.mockResolvedValue(draw);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<QueryClientProvider client={client}><DrawResultScreen id={draw.id} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('Nome na data do sorteio')).toBeOnTheScreen());
  expect(screen.getByText('Time 1')).toBeOnTheScreen();
  expect(screen.getByText('Soma: 30,5 · Média: 6,1')).toBeOnTheScreen();
  expect(screen.queryByText(/balanced-search-v1/)).not.toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Ver detalhes do sorteio' }));
  expect(screen.getByText(/balanced-search-v1/)).toBeOnTheScreen();
  expect(screen.getByText(/recorded-seed/)).toBeOnTheScreen();
  expect(request.mock.calls.map(([url]) => url)).toEqual([`draws/${draw.id}`]);
});

it('allows retrying an unsuccessful history read', async () => {
  request.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<QueryClientProvider client={client}><DrawHistoryScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen());
  await user.press(screen.getByRole('button', { name: 'Tentar novamente' }));
  await waitFor(() => expect(screen.getByText('Ainda não há sorteios registrados.')).toBeOnTheScreen());
  expect(request).toHaveBeenCalledTimes(2);
});

it('does not silently queue a draw for a later connection when the device becomes offline', async () => {
  await creation();
  const user = await selectTwenty();
  onlineManager.setOnline(false);
  request.mockRejectedValue(new Error('offline'));
  await user.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Conferir histórico' })).toBeOnTheScreen());
  expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  onlineManager.setOnline(true);
  expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

it.each(['unmount', 'blur', 'blur-and-refocus', 'new-session'])('does not navigate when an old draw succeeds after %s', async situation => {
  const view = await creation();
  const invalidation = jest.spyOn(client, 'invalidateQueries');
  await selectTwenty();
  let finish!: (value: Draw) => void;
  const pending = new Promise<Draw>(resolve => { finish = resolve; });
  request.mockReturnValueOnce(pending);
  await fireEvent.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  await waitFor(() => expect(client.isMutating()).toBe(1));
  if (situation === 'unmount') await view.unmount();
  else if (situation === 'new-session') {
    auth.mockReturnValue({ ...auth(), status: 'authenticated', error: null, session: { role: 'ADMIN', groupId: 'another-group', identityId: 'another-admin' } });
    request.mockResolvedValue(players);
    await view.rerender(<QueryClientProvider client={client}><DrawCreationScreen /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('0 de 20 selecionados')).toBeOnTheScreen());
  } else {
    await act(() => { mockBlur?.(); });
    if (situation === 'blur-and-refocus') await act(() => { mockFocus?.(); });
  }
  await act(async () => { finish(draw); await pending; });
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(mockReplace).not.toHaveBeenCalled();
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['draws', 'group', 'admin'] });
  if (situation === 'blur' || situation === 'blur-and-refocus') {
    await act(() => { mockFocus?.(); });
    await fireEvent.press(screen.getByRole('button', { name: /Sortear 4 times|Montando os times/ }));
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ver resultado' })).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Sortear 4 times' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(screen.getByRole('button', { name: 'Ver resultado' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sorteios/[id]', params: { id: draw.id } });
  }
});

it('preserves an uncertain result after blur, failure and refocus without submitting another draw', async () => {
  await creation();
  await selectTwenty();
  let reject!: (failure: Error) => void;
  request.mockReturnValueOnce(new Promise<Draw>((_resolve, fail) => { reject = fail; }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  await waitFor(() => expect(client.isMutating()).toBe(1));
  await act(() => { mockBlur?.(); });
  await act(() => { reject(new Error('late failure')); });
  await waitFor(() => expect(client.isMutating()).toBe(0));
  await act(() => { mockFocus?.(); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Conferir histórico' })).toBeOnTheScreen());
  expect(screen.getByRole('button', { name: 'Sortear 4 times' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sortear 4 times' }));
  expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(mockReplace).not.toHaveBeenCalled();
});
