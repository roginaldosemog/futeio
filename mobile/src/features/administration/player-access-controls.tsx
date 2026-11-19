import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import type { components } from '@futeio/contracts';
import { Action, Message } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useMachine } from '../../lib/machine';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';
import { initialLinkAccess, linkAccessTransition, type LinkAction } from './link-access-machine';
import { PrivateLinkReceipt } from './private-link-receipt';

type Props = { id: string; onChanged?: () => void | Promise<void> };

export function PlayerAccessControls({ id, onChanged }: Props) {
  const { session } = useAuth();
  if (session?.role !== 'ADMIN') return null;
  // One machine per player: another profile never inherits a link or a notice.
  return <LinkAccessControls key={id} id={id} onChanged={onChanged} />;
}

function LinkAccessControls({ id, onChanged }: Props) {
  const colors = useTheme();
  const [state, send] = useMachine(linkAccessTransition, initialLinkAccess);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') send({ type: 'conceal' }); });
    return () => { mounted.current = false; send({ type: 'conceal' }); subscription.remove(); };
  }, [send]);

  async function confirm() {
    // The machine is the lock: a second press is ignored while submitting.
    const submission = send({ type: 'confirm' });
    if (submission?.status !== 'submitting') return;
    try {
      if (submission.action === 'rotate') {
        const result = await apiRequest<components['schemas']['PlayerAccessLinkDto']>(`players/${encodeURIComponent(id)}/access-link/rotate`, { method: 'POST', body: {} });
        send({ type: 'rotated', url: result.accessUrl });
      } else {
        await apiRequest(`players/${encodeURIComponent(id)}/access-link`, { method: 'DELETE', body: {} });
        send({ type: 'revoked' });
      }
      // UI refresh errors do not invalidate a confirmed credential operation.
      if (mounted.current && onChanged) void Promise.resolve().then(onChanged).catch(() => {});
    } catch {
      send({ type: 'failed' });
    }
  }

  const pending = state.status === 'submitting';
  const prompt: LinkAction | null = state.status === 'confirming' || (state.status === 'submitting' && !state.concealed) ? state.action : null;
  return <View style={[styles.section, { borderColor: colors.separator }]}>
    <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>Acesso do jogador</Text>
    <Message>Gerar outro link ou revogar o acesso encerra as sessões abertas com o link anterior. O perfil e as avaliações são preservados.</Message>
    <Action secondary disabled={pending} onPress={() => { send({ type: 'choose', action: 'rotate' }); }}>Gerar novo link</Action>
    <Action secondary disabled={pending} onPress={() => { send({ type: 'choose', action: 'revoke' }); }}>Revogar acesso</Action>
    {prompt ? <View style={styles.confirmation}>
      <Message>{prompt === 'rotate' ? 'Substituir o link atual e encerrar as sessões?' : 'Encerrar as sessões e bloquear o link atual?'}</Message>
      <Action busy={pending} onPress={() => { void confirm(); }}>{prompt === 'rotate' ? 'Confirmar novo link' : 'Confirmar revogação'}</Action>
      <Action secondary disabled={pending} onPress={() => { send({ type: 'cancel' }); }}>Cancelar</Action>
    </View> : null}
    {state.status === 'rotated' ? <Message>Novo link gerado. O link anterior e as sessões dele foram revogados.</Message> : null}
    {state.status === 'rotated' && state.url === null ? <Message>O link foi ocultado e não pode ser exibido de novo. Para compartilhar, gere um novo link.</Message> : null}
    {state.status === 'revoked' ? <Message>Acesso revogado. Gere outro link para permitir uma nova entrada.</Message> : null}
    {state.status === 'failed' ? <Message error>Não foi possível confirmar a mudança. O acesso pode ter sido alterado. Gere e confirme um novo link antes de compartilhá-lo.</Message> : null}
    {state.status === 'rotated' && state.url !== null ? <PrivateLinkReceipt url={state.url} onHide={() => { send({ type: 'hide' }); }} /> : null}
  </View>;
}

const styles = StyleSheet.create({ section: { gap: 20, borderTopWidth: 1, paddingTop: 28, marginTop: 12 }, confirmation: { gap: 16 } });
