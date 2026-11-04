import type { components } from '@futeio/contracts';
import { AccessError, type NativeApiClient } from './api';
import { playerTokenFromLink } from './config';
import type { SessionStore } from './session-store';

export type Session = components['schemas']['SessionResponseDto'];
type NativeSession = components['schemas']['NativeSessionResponseDto'];
export type AuthState = {
  status: 'loading' | 'anonymous' | 'authenticated' | 'error';
  session: Session | null;
  error: string | null;
};

function validSession(value: Session): boolean {
  return Boolean(value && ['ADMIN', 'PLAYER'].includes(value.role) && typeof value.identityId === 'string' && typeof value.groupId === 'string');
}

export class SessionController {
  private state: AuthState = { status: 'loading', session: null, error: null };
  private listeners = new Set<() => void>();
  private revision = 0;
  private writes: Promise<void> = Promise.resolve();
  private mustRemove = false;

  constructor(private readonly api: NativeApiClient, private readonly store: SessionStore, private readonly clearPrivateData: () => void) {}

  connect(): () => void {
    const handle = () => { void this.expire(); };
    this.api.onUnauthorized = handle;
    return () => { if (this.api.onUnauthorized === handle) this.api.onUnauthorized = null; };
  }

  getSnapshot = (): AuthState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private update(state: AuthState) { this.state = state; for (const listener of this.listeners) listener(); }
  private write(action: () => Promise<void>) {
    const task = this.writes.catch(() => {}).then(action);
    this.writes = task;
    return task;
  }

  async initialize(quiet = false): Promise<void> {
    const revision = ++this.revision;
    const previous = this.state.session;
    if (!quiet) {
      this.api.setToken(null);
      this.clearPrivateData();
      this.update({ status: 'loading', session: null, error: null });
    }
    try {
      if (this.mustRemove) {
        await this.write(() => this.store.remove());
        if (revision !== this.revision) return;
        this.mustRemove = false;
      }
      const token = await this.store.read();
      if (revision !== this.revision) return;
      if (!token) { this.api.setToken(null); this.clearPrivateData(); this.update({ status: 'anonymous', session: null, error: null }); return; }
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { await this.expire(); return; }
      this.api.setToken(token);
      const session = await this.api.request<Session>('auth/me');
      if (!validSession(session)) throw new Error('Sessão inválida.');
      if (revision !== this.revision) return;
      if (quiet && previous && (previous.identityId !== session.identityId || previous.groupId !== session.groupId || previous.role !== session.role)) {
        await this.expire();
        return;
      }
      this.update({ status: 'authenticated', session, error: null });
    } catch {
      if (revision === this.revision) {
        this.api.setToken(null);
        this.clearPrivateData();
        this.update({ status: 'error', session: null, error: 'Não foi possível verificar seu acesso. Confira a conexão e tente novamente.' });
      }
    }
  }

  // Returning from the native photo picker/share sheet must validate access
  // without unmounting a form that still owns an in-flight native operation.
  revalidate(): Promise<void> { return this.initialize(true); }

  signIn = (email: string, password: string): Promise<void> => this.authenticate('auth/native/admin/login', { email: email.trim(), password });

  redeemLink = async (link: string): Promise<void> => {
    let token: string;
    try { token = playerTokenFromLink(link); }
    catch { throw new Error('Use o link pessoal enviado pelo administrador desta pelada.'); }
    await this.authenticate('auth/native/player/redeem', { token });
  };

  private async authenticate(path: string, body: object): Promise<void> {
    const revision = ++this.revision;
    this.api.setToken(null);
    this.clearPrivateData();
    this.update({ status: 'anonymous', session: null, error: null });
    try {
      await this.write(() => this.store.remove());
      const result = await this.api.authenticate<NativeSession>(path, body);
      if (!result || !/^[A-Za-z0-9_-]{43}$/.test(result.token) || !validSession(result.session)) throw new Error('Sessão inválida.');
      await this.write(async () => { if (revision === this.revision) await this.store.write(result.token); });
      if (revision !== this.revision) return;
      this.api.setToken(result.token);
      this.mustRemove = false;
      this.update({ status: 'authenticated', session: result.session, error: null });
    } catch (error) {
      if (revision !== this.revision) return;
      const message = error instanceof AccessError && error.status === 401
        ? (path.endsWith('login') ? 'E-mail ou senha inválidos.' : 'Este link foi revogado ou não é válido. Peça outro ao administrador.')
        : error instanceof AccessError && error.status === 429
          ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
          : 'Não foi possível entrar. Confira a conexão, a configuração da API e tente novamente.';
      this.update({ status: 'anonymous', session: null, error: message });
      throw new Error(message, { cause: error });
    }
  }

  async signOut(): Promise<void> {
    const revision = ++this.revision;
    const revoke = this.api.revokeSession().catch(() => false);
    this.clearPrivateData();
    this.mustRemove = true;
    this.update({ status: 'loading', session: null, error: null });
    try {
      await this.write(() => this.store.remove());
      if (revision !== this.revision) return;
      this.mustRemove = false;
      const revoked = await revoke;
      if (revision !== this.revision) return;
      this.update({ status: 'anonymous', session: null, error: revoked === false ? 'Acesso removido deste aparelho. Sem conexão, não foi possível confirmar o encerramento no servidor.' : null });
    } catch {
      if (revision === this.revision) this.update({ status: 'error', session: null, error: 'Não foi possível remover o acesso salvo. Tente novamente antes de compartilhar o aparelho.' });
    }
  }

  private async expire(): Promise<void> {
    const revision = ++this.revision;
    this.api.setToken(null);
    this.clearPrivateData();
    this.mustRemove = true;
    this.update({ status: 'loading', session: null, error: null });
    try {
      await this.write(() => this.store.remove());
      if (revision !== this.revision) return;
      this.mustRemove = false;
      this.update({ status: 'anonymous', session: null, error: 'Seu acesso expirou ou foi revogado. Entre novamente.' });
    } catch {
      if (revision === this.revision) this.update({ status: 'error', session: null, error: 'Não foi possível remover o acesso salvo. Tente novamente.' });
    }
  }
}
