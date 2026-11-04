import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { RatingForm } from '../src/features/players/rating-form';
import { ProfileEditor } from '../src/features/players/profile-editor';
import { apiRequest, privatePhoto, AccessError } from '../src/lib/api';
import { selectProfilePhoto } from '../src/features/players/photo-selection';
import { PrivatePhoto } from '../src/features/players/private-photo';

jest.mock('../src/lib/api', () => ({ apiRequest: jest.fn(), privatePhoto: jest.fn(), AccessError: class extends Error { status: number; constructor(code: number) { super('request failed'); this.status = code; } } }));
jest.mock('../src/features/players/photo-selection', () => ({ selectProfilePhoto: jest.fn() }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ session: { groupId: 'group', identityId: 'identity', role: 'PLAYER' } }) }));
const request = jest.mocked(apiRequest);
const pick = jest.mocked(selectProfilePhoto);
let client: QueryClient;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false, networkMode: 'always' } } });
  request.mockReset(); request.mockResolvedValue(undefined);
  pick.mockReset();
});
afterEach(() => { client.clear(); jest.useRealTimers(); });
const wrap = (element: React.ReactElement) => <QueryClientProvider client={client}>{element}</QueryClientProvider>;

it.each(['', '-1', '11', '2.5'])('rejects an invalid rating %s without sending a vote', async value => {
  await render(wrap(<RatingForm id="player" own={false} />));
  await fireEvent.changeText(screen.getByLabelText('Sua nota, de 0 a 10'), value);
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar avaliação' }));
  expect(screen.getByText('Escolha uma nota inteira de 0 a 10.')).toBeOnTheScreen();
  expect(request).not.toHaveBeenCalled();
});

it('accepts zero as a self evaluation and uses only the target/rating contract', async () => {
  await render(wrap(<RatingForm id="player" own current={9} />));
  expect(screen.getByText('Sua autoavaliação')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Sua nota, de 0 a 10'), '0');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar avaliação' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('players/player/evaluations', { method: 'POST', body: { rating: 0 } }));
  expect(screen.getByText('Avaliação salva. Sua contribuição anterior foi substituída.')).toBeOnTheScreen();
});

it('keeps a pending vote from being submitted twice and reports an uncertain result without retry', async () => {
  let reject!: (reason: Error) => void;
  request.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  await render(wrap(<RatingForm id="player" own={false} current={8} />));
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar avaliação' }));
  expect(screen.getByRole('button', { name: 'Salvar avaliação' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar avaliação' }));
  reject(new Error('connection lost'));
  await waitFor(() => expect(screen.getByText(/Não foi possível confirmar sua avaliação/)).toBeOnTheScreen());
  expect(request).toHaveBeenCalledTimes(1);
});

it('validates and trims a profile name before saving', async () => {
  await render(wrap(<ProfileEditor id="player" name="Ana" hasPhoto={false} />));
  await fireEvent.changeText(screen.getByLabelText('Nome do jogador'), '  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar nome' }));
  expect(request).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Nome do jogador'), '  Ana Silva  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar nome' }));
  await waitFor(() => expect(screen.getByText('Nome salvo.')).toBeOnTheScreen());
  expect(request).toHaveBeenCalledWith('players/player/profile', { method: 'POST', body: { name: 'Ana Silva' } });
});

it('does not upload when the native picker is cancelled', async () => {
  pick.mockResolvedValue(null);
  await render(wrap(<ProfileEditor id="player" name="Ana" hasPhoto={false} />));
  await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Escolher foto' })).toBeEnabled());
  expect(request).not.toHaveBeenCalled();
});

it('uploads only processed base64 and keeps photos out of query data', async () => {
  pick.mockResolvedValue('synthetic-processed-jpeg');
  await render(wrap(<ProfileEditor id="player" name="Ana" hasPhoto={false} />));
  await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto' }));
  await waitFor(() => expect(screen.getByText('Foto salva.')).toBeOnTheScreen());
  expect(request).toHaveBeenCalledWith('players/player/photo', { method: 'POST', body: { data: 'synthetic-processed-jpeg' } });
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});

it('requires confirmation before removing the existing photo', async () => {
  await render(wrap(<ProfileEditor id="player" name="Ana" hasPhoto />));
  await fireEvent.press(screen.getByRole('button', { name: 'Remover foto' }));
  expect(request).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(request).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Remover foto' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar remoção' }));
  await waitFor(() => expect(screen.getByText('Foto removida.')).toBeOnTheScreen());
  expect(request).toHaveBeenCalledWith('players/player/photo', { method: 'DELETE' });
});

it('discards a picker result if the editor unmounted while native selection was open', async () => {
  let resolve!: (value: string) => void;
  pick.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = await render(wrap(<ProfileEditor id="player" name="Ana" hasPhoto={false} />));
  await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto' }));
  await view.unmount();
  resolve('synthetic-processed-jpeg');
  await Promise.resolve(); await Promise.resolve();
  expect(request).not.toHaveBeenCalled();
});

it('refreshes the retained roster after a confirmed profile save finishes following native Back', async () => {
  let committed = false;
  let resolve!: (value: unknown) => void;
  request.mockImplementation(async <T,>(path: string): Promise<T> => {
    if (path === 'players') return [{ id: 'player', name: committed ? 'Ana Nova' : 'Ana' }] as T;
    return await new Promise<T>(done => { resolve = value => done(value as T); });
  });
  const observer = new QueryObserver(client, { queryKey: ['players', 'group', 'identity'], queryFn: () => apiRequest<{ name: string }[]>('players') });
  const stop = observer.subscribe(() => {});
  client.setQueryData(['players', 'other-group', 'other-identity'], [{ name: 'Outro grupo' }]);
  try {
    await waitFor(() => expect(observer.getCurrentResult().data?.[0]?.name).toBe('Ana'));
    const view = await render(wrap(<ProfileEditor id="player" name="Ana" hasPhoto={false} />));
    await fireEvent.changeText(screen.getByLabelText('Nome do jogador'), 'Ana Nova');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar nome' }));
    await view.unmount();
    committed = true; resolve({});
    await waitFor(() => expect(observer.getCurrentResult().data?.[0]?.name).toBe('Ana Nova'));
    expect(client.getQueryState(['players', 'other-group', 'other-identity'])?.isInvalidated).toBe(false);
  } finally { stop(); }
});

it('hides a cached photo when the server definitively reports it no longer exists', async () => {
  jest.mocked(privatePhoto).mockResolvedValueOnce('data:image/jpeg;base64,/9j/');
  await render(wrap(<PrivatePhoto name="Ana" url="/api/v1/players/player/photo" />));
  await waitFor(() => expect(screen.getByLabelText('Foto de Ana')).toBeOnTheScreen());
  jest.mocked(privatePhoto).mockRejectedValueOnce(new AccessError(404));
  await act(async () => { await client.invalidateQueries({ queryKey: ['photo'] }); });
  await waitFor(() => expect(screen.getByText('Não foi possível carregar a foto.')).toBeOnTheScreen());
  expect(screen.queryByLabelText('Foto de Ana')).not.toBeOnTheScreen();
});
