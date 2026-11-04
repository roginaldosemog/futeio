import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { components } from '@futeio/contracts';
import { Action, Loading, Message } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';

type Profile = components['schemas']['PlayerProfileDto'];
type Evaluations = components['schemas']['PlayerEvaluationsDto'];
export function ProfileScreen({ id }: { id: string }) {
  const auth = useAuth();
  const colors = useTheme();
  const scope = [auth.session?.groupId, auth.session?.identityId, id];
  const profile = useQuery({ queryKey: ['profile', ...scope], queryFn: ({ signal }) => apiRequest<Profile>(`players/${encodeURIComponent(id)}`, { signal }), enabled: Boolean(id) });
  const evaluations = useQuery({ queryKey: ['evaluations', ...scope], queryFn: ({ signal }) => apiRequest<Evaluations>(`players/${encodeURIComponent(id)}/evaluations`, { signal }), enabled: Boolean(id) });
  if (!id || profile.isError) return <View style={styles.content}><Message error>Não foi possível abrir este perfil. Confira sua conexão ou volte à lista.</Message><Action secondary onPress={() => { void profile.refetch(); }}>Tentar novamente</Action></View>;
  if (profile.isPending) return <Loading label="Carregando perfil..." />;
  const player = profile.data;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>{player.name}</Text>
    <Message>{player.isOwnProfile ? 'Seu perfil' : 'Jogador da pelada'}</Message>
    <View style={[styles.summary, { borderColor: colors.separator }]}>
      <Text style={[typography.label, { color: colors.secondary }]}>Nota consolidada</Text>
      <Text style={[typography.title, { color: colors.foreground, fontVariant: ['tabular-nums'] }]}>{player.rating.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} / 10</Text>
      {evaluations.data ? <Message>{evaluations.data.evaluationCount} {evaluations.data.evaluationCount === 1 ? 'avaliação vigente' : 'avaliações vigentes'}.{evaluations.data.discardedPerSide ? ` O cálculo desconsidera ${evaluations.data.discardedPerSide} menor(es) e maior(es) nota(s).` : ''}</Message> : null}
    </View>
    <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>Avaliações recebidas</Text>
    <Message>{auth.session?.role === 'ADMIN' ? 'Como administrador, você pode ver quem deu cada nota.' : 'Somente sua própria autoria é identificada. As demais avaliações são anônimas.'}</Message>
    {evaluations.isPending ? <Message>Carregando avaliações...</Message> : null}
    {evaluations.isError ? <><Message error>Não foi possível carregar as avaliações.</Message><Action secondary onPress={() => { void evaluations.refetch(); }}>Tentar novamente</Action></> : null}
    {evaluations.data?.evaluations.map((row, index) => <View key={index} style={[styles.row, { borderColor: colors.separator }]}><Text style={[typography.body, { color: colors.foreground, flex: 1 }]}>{row.isOwn ? `Você${row.authorName ? ` · ${row.authorName}` : ''}` : row.authorName ?? 'Avaliação anônima'}</Text><Text style={[typography.label, { color: colors.foreground }]}>{row.rating}</Text></View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 48, gap: 20, maxWidth: 760, width: '100%', alignSelf: 'center' }, summary: { paddingVertical: 24, gap: 10, borderTopWidth: 1, borderBottomWidth: 1 }, row: { flexDirection: 'row', gap: 16, paddingVertical: 16, borderBottomWidth: 1, alignItems: 'center' } });
