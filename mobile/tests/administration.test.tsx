import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { AppState, Share, Text, type AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { components } from '@futeio/contracts';
import { PlayerCreationScreen } from '../src/features/administration/player-creation-screen';
import { PlayerAccessControls } from '../src/features/administration/player-access-controls';
import { apiRequest, AccessError } from '../src/lib/api';
import { useAuth } from '../src/providers/auth-provider';

jest.mock('../src/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../src/lib/api', () => ({ ...jest.requireActual<typeof import('../src/lib/api')>('../src/lib/api'), apiRequest: jest.fn() }));

const mockAuth = jest.mocked(useAuth);
const mockRequest = jest.mocked(apiRequest);
const link = `https://example.test/acesso/jogador#token=${'P'.repeat(43)}`;
const player: components['schemas']['PlayerSummaryDto'] = { id: 'player-one', name: 'Ana', rating: 0, isOwnProfile: false };
let client: QueryClient;
let stateListeners: Set<(state: AppStateStatus) => void>;

function setupRequest(roster: components['schemas']['PlayerSummaryDto'][] = []) {
  mockRequest.mockImplementation(async <T,>(requestPath: string, options?: { method?: string }): Promise<T> => {
    if (requestPath.endsWith('/access-link/rotate')) return { accessUrl: link } as T;
    if (requestPath.endsWith('/access-link')) return { message: 'Revoked' } as T;
    return (options?.method === 'POST' ? { player, accessUrl: link } : roster) as T;
  });
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  mockAuth.mockReturnValue({ status: 'authenticated', session: { role: 'ADMIN', identityId: 'admin-one', groupId: 'group-one' }, error: null, signIn: jest.fn(), redeemLink: jest.fn(), signOut: jest.fn(), retry: jest.fn() });
  stateListeners = new Set();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    stateListeners.add(listener);
    return { remove: () => { stateListeners.delete(listener); } };
  });
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  setupRequest();
});
afterEach(() => { client.clear(); jest.useRealTimers(); });

async function creation() {
  await render(<QueryClientProvider client={client}><PlayerCreationScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('Ainda não há jogadores cadastrados.')).toBeOnTheScreen());
}
function user() { return userEvent.setup({ advanceTimers: jest.advanceTimersByTime }); }
function posts() { return mockRequest.mock.calls.filter(([, options]) => options?.method === 'POST'); }

it('does not query or expose administration to a player', async () => {
  mockAuth.mockReturnValue({ ...mockAuth(), status: 'authenticated', error: null, session: { role: 'PLAYER', identityId: 'player-one', groupId: 'group-one' } });
  await render(<QueryClientProvider client={client}><PlayerCreationScreen /></QueryClientProvider>);
  expect(screen.getByText('Somente o administrador pode cadastrar jogadores.')).toBeOnTheScreen();
  expect(mockRequest).not.toHaveBeenCalled();
});

it('requires the initial rating and rejects a fractional rating before sending', async () => {
  await creation();
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), 'Ana');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  expect(posts()).toHaveLength(0);
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '7.5');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  expect(posts()).toHaveLength(0);
  expect(screen.getByText('Informe um nome de 1 a 100 caracteres e uma nota inteira de 0 a 10.')).toBeOnTheScreen();
});

it('accepts rating zero and shares the confirmed credential only after an explicit action', async () => {
  await creation();
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), '  Ana  ');
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '0');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  expect(posts()).toEqual([['players', { method: 'POST', body: { name: 'Ana', initialRating: 0, linkToCurrentAdministrator: false } }]]);
  expect(Share.share).not.toHaveBeenCalled();
  expect(screen.getByText(link)).toBeOnTheScreen();
  expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain(link);
  expect(client.getMutationCache().getAll()).toHaveLength(0);
  await interaction.press(screen.getByRole('button', { name: 'Compartilhar link pessoal' }));
  expect(Share.share).toHaveBeenCalledWith({ message: link });
  await interaction.press(screen.getByRole('button', { name: 'Ocultar link' }));
  expect(screen.queryByText(link)).not.toBeOnTheScreen();
});

it('does not duplicate a pending creation on a second press', async () => {
  let finish!: (response: unknown) => void;
  mockRequest.mockImplementation(async <T,>(_path: string, options?: { method?: string }): Promise<T> => options?.method === 'POST'
    ? await new Promise<T>(resolve => { finish = resolve as (response: unknown) => void; })
    : [] as T);
  await creation();
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), 'Ana');
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '8');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  await interaction.press(screen.getByRole('button', { name: 'Cadastrando...' }));
  expect(posts()).toHaveLength(1);
  await act(async () => { finish({ player, accessUrl: link }); });
});

it('keeps a confirmed receipt when the roster refresh fails', async () => {
  let saved = false;
  mockRequest.mockImplementation(async <T,>(_path: string, options?: { method?: string }): Promise<T> => {
    if (options?.method === 'POST') { saved = true; return { player, accessUrl: link } as T; }
    if (saved) throw new Error('offline');
    return [] as T;
  });
  await creation();
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), 'Ana');
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '8');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  await waitFor(() => expect(screen.getByText('Não foi possível atualizar a lista. Confira a conexão e tente novamente.')).toBeOnTheScreen());
  expect(screen.getByText('Cadastro confirmado: Ana.')).toBeOnTheScreen();
  expect(screen.getByText(link)).toBeOnTheScreen();
});

it('requires explicit successful reconciliation before retrying an uncertain creation', async () => {
  mockRequest.mockImplementation(async <T,>(_path: string, options?: { method?: string }): Promise<T> => {
    if (options?.method === 'POST') throw new AccessError(503);
    return [] as T;
  });
  await creation();
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), 'Ana');
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '8');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  expect(screen.getByRole('button', { name: 'Confirmar cadastro' })).toBeDisabled();
  expect(posts()).toHaveLength(1);
  await interaction.press(screen.getByRole('button', { name: 'Atualizar e conferir lista' }));
  expect(screen.getByRole('button', { name: 'Confirmar cadastro' })).toBeEnabled();
});

it('replaces the uncertain warning with guidance after the roster was checked and blocks again on a new uncertain result', async () => {
  mockRequest.mockImplementation(async <T,>(_path: string, options?: { method?: string }): Promise<T> => {
    if (options?.method === 'POST') throw new AccessError(503);
    return [] as T;
  });
  await creation();
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), 'Ana');
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '8');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Ele pode ter sido registrado/);
  await interaction.press(screen.getByRole('button', { name: 'Atualizar e conferir lista' }));
  expect(screen.getByText('Lista atualizada. Confira se o jogador já aparece nela antes de cadastrar novamente.')).toBeOnTheScreen();
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(screen.getByLabelText('Nome do jogador')).toHaveProp('value', 'Ana');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  expect(posts()).toHaveLength(2);
  expect(screen.getByRole('alert')).toHaveTextContent(/Ele pode ter sido registrado/);
  expect(screen.getByRole('button', { name: 'Confirmar cadastro' })).toBeDisabled();
});

it('disables linking another player to an administrator with an existing profile', async () => {
  setupRequest([{ ...player, isOwnProfile: true }]);
  await render(<QueryClientProvider client={client}><PlayerCreationScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('Seu perfil de jogador já está cadastrado.')).toBeOnTheScreen());
  expect(screen.getByLabelText('Este é o meu perfil')).toBeDisabled();
});

it('clears a confirmed link on background and does not restore it on return', async () => {
  await creation();
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), 'Ana');
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '8');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  expect(screen.getByText(link)).toBeOnTheScreen();
  await act(() => { for (const listener of stateListeners) listener('background'); });
  await act(() => { for (const listener of stateListeners) listener('active'); });
  expect(screen.queryByText(link)).not.toBeOnTheScreen();
});

it('does not expose link controls to a player', async () => {
  mockAuth.mockReturnValue({ ...mockAuth(), status: 'authenticated', error: null, session: { role: 'PLAYER', identityId: 'player-one', groupId: 'group-one' } });
  await render(<PlayerAccessControls id="player-one" />);
  expect(screen.queryByRole('button', { name: 'Gerar novo link' })).not.toBeOnTheScreen();
  expect(mockRequest).not.toHaveBeenCalled();
});

it('requires confirmation and cancellation never rotates a link', async () => {
  await render(<PlayerAccessControls id="player-one" />);
  const interaction = user();
  await interaction.press(screen.getByRole('button', { name: 'Gerar novo link' }));
  expect(mockRequest).not.toHaveBeenCalled();
  await interaction.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(mockRequest).not.toHaveBeenCalled();
  await interaction.press(screen.getByRole('button', { name: 'Gerar novo link' }));
  await interaction.press(screen.getByRole('button', { name: 'Confirmar novo link' }));
  expect(mockRequest).toHaveBeenCalledWith('players/player-one/access-link/rotate', { method: 'POST', body: {} });
  expect(screen.getByText(link)).toBeOnTheScreen();
  expect(Share.share).not.toHaveBeenCalled();
});

it('revokes only after confirmation and does not expose a credential', async () => {
  await render(<PlayerAccessControls id="player-one" />);
  const interaction = user();
  await interaction.press(screen.getByRole('button', { name: 'Revogar acesso' }));
  expect(mockRequest).not.toHaveBeenCalled();
  await interaction.press(screen.getByRole('button', { name: 'Confirmar revogação' }));
  expect(mockRequest).toHaveBeenCalledWith('players/player-one/access-link', { method: 'DELETE', body: {} });
  expect(screen.getByText('Acesso revogado. Gere outro link para permitir uma nova entrada.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Compartilhar link pessoal' })).not.toBeOnTheScreen();
});

it('does not reveal an old or unconfirmed link after a failed rotation', async () => {
  await render(<PlayerAccessControls id="player-one" />);
  const interaction = user();
  await interaction.press(screen.getByRole('button', { name: 'Gerar novo link' }));
  await interaction.press(screen.getByRole('button', { name: 'Confirmar novo link' }));
  expect(screen.getByText(link)).toBeOnTheScreen();
  mockRequest.mockRejectedValue(new Error('offline'));
  await interaction.press(screen.getByRole('button', { name: 'Gerar novo link' }));
  await interaction.press(screen.getByRole('button', { name: 'Confirmar novo link' }));
  expect(screen.queryByText(link)).not.toBeOnTheScreen();
  expect(screen.getByText('Não foi possível confirmar a mudança. O acesso pode ter sido alterado. Gere e confirme um novo link antes de compartilhá-lo.')).toBeOnTheScreen();
});

it('does not reintroduce a late rotation credential after the app leaves the foreground', async () => {
  let finish!: (response: unknown) => void;
  mockRequest.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await render(<PlayerAccessControls id="player-one" />);
  const interaction = user();
  await interaction.press(screen.getByRole('button', { name: 'Gerar novo link' }));
  await interaction.press(screen.getByRole('button', { name: 'Confirmar novo link' }));
  await act(() => { for (const listener of stateListeners) listener('inactive'); });
  await act(async () => { finish({ accessUrl: link }); });
  expect(screen.queryByText(link)).not.toBeOnTheScreen();
});

it('reports a rotation that finished in the background and tells the administrator the link is gone', async () => {
  let finish!: (response: unknown) => void;
  mockRequest.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await render(<PlayerAccessControls id="player-one" />);
  const interaction = user();
  await interaction.press(screen.getByRole('button', { name: 'Gerar novo link' }));
  await interaction.press(screen.getByRole('button', { name: 'Confirmar novo link' }));
  await act(() => { for (const listener of stateListeners) listener('background'); });
  await act(async () => { finish({ accessUrl: link }); });
  await act(() => { for (const listener of stateListeners) listener('active'); });
  expect(screen.queryByText(link)).not.toBeOnTheScreen();
  expect(screen.getByText('Novo link gerado. O link anterior e as sessões dele foram revogados.')).toBeOnTheScreen();
  expect(screen.getByText('O link foi ocultado e não pode ser exibido de novo. Para compartilhar, gere um novo link.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Gerar novo link' })).toBeEnabled();
});

it('clears an old player credential when the profile changes', async () => {
  const view = await render(<PlayerAccessControls id="player-one" />);
  const interaction = user();
  await interaction.press(screen.getByRole('button', { name: 'Gerar novo link' }));
  await interaction.press(screen.getByRole('button', { name: 'Confirmar novo link' }));
  expect(screen.getByText(link)).toBeOnTheScreen();
  await view.rerender(<PlayerAccessControls id="player-two" />);
  expect(screen.queryByText(link)).not.toBeOnTheScreen();
});

it('does not treat a failed refresh callback as a failed credential rotation', async () => {
  const refresh = jest.fn(async () => { throw new Error('refresh failed'); });
  await render(<PlayerAccessControls id="player-one" onChanged={refresh} />);
  const interaction = user();
  await interaction.press(screen.getByRole('button', { name: 'Gerar novo link' }));
  await interaction.press(screen.getByRole('button', { name: 'Confirmar novo link' }));
  expect(refresh).toHaveBeenCalled();
  expect(screen.getByText(link)).toBeOnTheScreen();
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
});

it('does not reveal a late creation credential after backgrounding', async () => {
  let finish!: (response: unknown) => void;
  mockRequest.mockImplementation(async <T,>(_path: string, options?: { method?: string }): Promise<T> => options?.method === 'POST'
    ? await new Promise<T>(resolve => { finish = resolve as (response: unknown) => void; })
    : [] as T);
  await creation();
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), 'Ana');
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '8');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  await act(() => { for (const listener of stateListeners) listener('background'); });
  await act(async () => { finish({ player, accessUrl: link }); });
  expect(screen.getByText('Cadastro confirmado: Ana.')).toBeOnTheScreen();
  expect(screen.queryByText(link)).not.toBeOnTheScreen();
});

it('reconciles the retained roster after creation confirms following native Back', async () => {
  let finish!: (response: unknown) => void;
  let serverRoster: components['schemas']['PlayerSummaryDto'][] = [];
  mockRequest.mockImplementation(async <T,>(_path: string, options?: { method?: string }): Promise<T> => options?.method === 'POST'
    ? await new Promise<T>(resolve => { finish = resolve as (response: unknown) => void; })
    : serverRoster as T);
  const replacementKey = ['players', 'group-one', 'another-identity'];
  client.setQueryDefaults(replacementKey, { gcTime: Infinity });
  client.setQueryData(replacementKey, []);
  function RetainedRoster() {
    const roster = useQuery({ queryKey: ['players', 'group-one', 'admin-one'], queryFn: () => apiRequest<components['schemas']['PlayerSummaryDto'][]>('players'), staleTime: Infinity });
    return <Text>Jogadores retidos: {roster.data?.map(entry => entry.name).join(', ') ?? ''}</Text>;
  }
  const view = await render(<QueryClientProvider client={client}><RetainedRoster /><PlayerCreationScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('Ainda não há jogadores cadastrados.')).toBeOnTheScreen());
  const interaction = user();
  await interaction.type(screen.getByLabelText('Nome do jogador'), 'Ana');
  await interaction.type(screen.getByLabelText('Nota inicial, de 0 a 10'), '8');
  await interaction.press(screen.getByRole('button', { name: 'Confirmar cadastro' }));
  await view.rerender(<QueryClientProvider client={client}><RetainedRoster /></QueryClientProvider>);
  expect(screen.queryByLabelText('Nome do jogador')).not.toBeOnTheScreen();
  serverRoster = [player];
  await act(async () => { finish({ player, accessUrl: link }); });
  await waitFor(() => expect(screen.getByText('Jogadores retidos: Ana')).toBeOnTheScreen());
  expect(screen.queryByText(link)).not.toBeOnTheScreen();
  expect(client.getQueryState(replacementKey)?.isInvalidated).toBe(false);
  expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain(link);
});
