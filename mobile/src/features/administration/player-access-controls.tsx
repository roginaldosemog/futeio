import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import type { components } from '@futeio/contracts';
import { Action, Message } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';
import { PrivateLinkReceipt } from './private-link-receipt';

export function PlayerAccessControls({ id, onChanged }: { id: string; onChanged?: () => void | Promise<void> }) {
  const { session } = useAuth();
  const colors = useTheme();
  const [action, setAction] = useState<'rotate' | 'revoke' | null>(null);
  const [url, setUrl] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    setUrl(undefined); setAction(null); setNotice(undefined); setError(undefined);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { revision.current++; setUrl(undefined); setAction(null); }
    });
    return () => { mounted.current = false; revision.current++; subscription.remove(); };
  }, [id]);

  async function confirm() {
    if (session?.role !== 'ADMIN' || !action || lock.current) return;
    lock.current = true;
    setPending(true); setUrl(undefined); setError(undefined); setNotice(undefined);
    const privacyRevision = revision.current;
    try {
      if (action === 'rotate') {
        const result = await apiRequest<components['schemas']['PlayerAccessLinkDto']>(`players/${encodeURIComponent(id)}/access-link/rotate`, { method: 'POST', body: {} });
        if (mounted.current && privacyRevision === revision.current) {
          setUrl(result.accessUrl);
          setNotice('Novo link gerado. O link anterior e as sessões dele foram revogados.');
        }
      } else {
        await apiRequest(`players/${encodeURIComponent(id)}/access-link`, { method: 'DELETE', body: {} });
        if (mounted.current && privacyRevision === revision.current) setNotice('Acesso revogado. Gere outro link para permitir uma nova entrada.');
      }
      if (mounted.current && privacyRevision === revision.current) setAction(null);
      // UI refresh errors do not invalidate a confirmed credential operation.
      if (mounted.current && privacyRevision === revision.current && onChanged) void Promise.resolve().then(onChanged).catch(() => {});
    } catch {
      if (mounted.current && privacyRevision === revision.current) {
        setAction(null);
        setError('Não foi possível confirmar a mudança. O acesso pode ter sido alterado. Gere e confirme um novo link antes de compartilhá-lo.');
      }
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }

  if (session?.role !== 'ADMIN') return null;
  function choose(next: 'rotate' | 'revoke') { setAction(next); setUrl(undefined); setNotice(undefined); setError(undefined); }
  return <View style={[styles.section, { borderColor: colors.separator }]}>
    <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>Acesso do jogador</Text>
    <Message>Gerar outro link ou revogar o acesso encerra as sessões abertas com o link anterior. O perfil e as avaliações são preservados.</Message>
    <Action secondary disabled={pending} onPress={() => choose('rotate')}>Gerar novo link</Action>
    <Action secondary disabled={pending} onPress={() => choose('revoke')}>Revogar acesso</Action>
    {action ? <View style={styles.confirmation}>
      <Message>{action === 'rotate' ? 'Substituir o link atual e encerrar as sessões?' : 'Encerrar as sessões e bloquear o link atual?'}</Message>
      <Action busy={pending} onPress={() => { void confirm(); }}>{action === 'rotate' ? 'Confirmar novo link' : 'Confirmar revogação'}</Action>
      <Action secondary disabled={pending} onPress={() => setAction(null)}>Cancelar</Action>
    </View> : null}
    {notice ? <Message>{notice}</Message> : null}
    {error ? <Message error>{error}</Message> : null}
    {url ? <PrivateLinkReceipt url={url} onHide={() => setUrl(undefined)} /> : null}
  </View>;
}

const styles = StyleSheet.create({ section: { gap: 20, borderTopWidth: 1, paddingTop: 28, marginTop: 12 }, confirmation: { gap: 16 } });
