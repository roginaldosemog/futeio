import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { components } from '@futeio/contracts';
import { Action, Loading, Message } from '../../components/ui';
import { AccessError, apiRequest } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';
import { RatingForm } from './rating-form';
import { ProfileEditor } from './profile-editor';
import { PrivatePhoto } from './private-photo';
import { PlayerAccessControls } from '../administration/player-access-controls';

type Profile = components['schemas']['PlayerProfileDto'];
type Evaluations = components['schemas']['PlayerEvaluationsDto'];
const denied = (error: unknown) => error instanceof AccessError && [401, 403, 404].includes(error.status);
export function ProfileScreen({ id }: { id: string }) {
  const auth = useAuth();
  const colors = useTheme();
  const scope = [auth.session?.groupId, auth.session?.identityId, id];
  const profile = useQuery({ queryKey: ['profile', ...scope], queryFn: ({ signal }) => apiRequest<Profile>(`players/${encodeURIComponent(id)}`, { signal }), enabled: Boolean(id) });
  const evaluations = useQuery({ queryKey: ['evaluations', ...scope], queryFn: ({ signal }) => apiRequest<Evaluations>(`players/${encodeURIComponent(id)}/evaluations`, { signal }), enabled: Boolean(id) });
  if (!id || (profile.isError && (!profile.data || denied(profile.error)))) return <View style={styles.content}><Message error>Não foi possível abrir este perfil. Confira sua conexão ou volte à lista.</Message><Action secondary onPress={() => { void profile.refetch(); }}>Tentar novamente</Action></View>;
  if (profile.isPending || !profile.data) return <Loading label="Carregando perfil..." />;
  const player = profile.data;
  const table = evaluations.isError && denied(evaluations.error) ? undefined : evaluations.data;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    {player.photoUrl ? <PrivatePhoto url={player.photoUrl} name={player.name} /> : null}
    <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>{player.name}</Text>
    <Message>{player.isOwnProfile ? 'Seu perfil' : 'Jogador da pelada'}</Message>
    {profile.isRefetchError ? <><Message error>Não foi possível atualizar o perfil. Exibindo os últimos dados confirmados.</Message><Action secondary onPress={() => { void profile.refetch(); }}>Atualizar perfil</Action></> : null}
    <View style={[styles.summary, { borderColor: colors.separator }]}>
      <Text style={[typography.label, { color: colors.secondary }]}>Nota consolidada</Text>
      <Text style={[typography.title, { color: colors.foreground, fontVariant: ['tabular-nums'] }]}>{player.rating.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} / 10</Text>
      {table ? <Message>{table.evaluationCount} {table.evaluationCount === 1 ? 'avaliação vigente' : 'avaliações vigentes'}.{table.discardedPerSide ? ` O cálculo desconsidera ${table.discardedPerSide} menor(es) e maior(es) nota(s).` : ''}</Message> : null}
    </View>
    {table ? <RatingForm key={`rating-${id}`} id={id} current={table.evaluations.find(row => row.isOwn)?.rating} own={player.isOwnProfile} /> : null}
    <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>Avaliações recebidas</Text>
    <Message>{auth.session?.role === 'ADMIN' ? 'Como administrador, você pode ver quem deu cada nota.' : 'Somente sua própria autoria é identificada. As demais avaliações são anônimas.'}</Message>
    {evaluations.isPending ? <Message>Carregando avaliações...</Message> : null}
    {evaluations.isError ? <><Message error>Não foi possível carregar as avaliações.</Message><Action secondary onPress={() => { void evaluations.refetch(); }}>Tentar novamente</Action></> : null}
    {table?.evaluations.map((row, index) => <View key={index} style={[styles.row, { borderColor: colors.separator }]}><Text style={[typography.body, { color: colors.foreground, flex: 1 }]}>{row.isOwn ? `Você${row.authorName ? ` · ${row.authorName}` : ''}` : row.authorName ?? 'Avaliação anônima'}</Text><Text style={[typography.label, { color: colors.foreground }]}>{row.rating}</Text></View>)}
    {player.canEdit ? <ProfileEditor key={`editor-${id}`} id={id} name={player.name} hasPhoto={Boolean(player.photoUrl)} /> : null}
    {auth.session?.role === 'ADMIN' ? <PlayerAccessControls key={`access-${id}`} id={id} /> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 48, gap: 20, maxWidth: 760, width: '100%', alignSelf: 'center' }, summary: { paddingVertical: 24, gap: 10, borderTopWidth: 1, borderBottomWidth: 1 }, row: { flexDirection: 'row', gap: 16, paddingVertical: 16, borderBottomWidth: 1, alignItems: 'center' } });
