import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { components } from '@futeio/contracts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action, Field, Message } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';

type Player = components['schemas']['PlayerSummaryDto'];
export function RosterScreen() {
  const auth = useAuth();
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const roster = useQuery({ queryKey: ['players', auth.session?.groupId, auth.session?.identityId], queryFn: ({ signal }) => apiRequest<Player[]>('players', { signal }) });
  const visible = roster.data?.filter(player => player.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))) ?? [];
  return <FlatList data={visible} keyExtractor={player => player.id} contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom) }]} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={roster.isFetching && !roster.isPending} onRefresh={() => { void roster.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
    ListHeaderComponent={<View style={styles.header}>
      <View style={styles.account}><Text style={[typography.detail, { color: colors.secondary, flex: 1 }]}>{auth.session?.role === 'ADMIN' ? 'Administrador' : 'Membro da pelada'}</Text><Action secondary busy={signingOut} onPress={() => { setSigningOut(true); setLogoutError(false); void auth.signOut().catch(() => setLogoutError(true)).finally(() => setSigningOut(false)); }}>Sair</Action></View>
      {logoutError ? <Message error>Não foi possível confirmar a saída. Tente novamente.</Message> : null}
      <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>Jogadores</Text>
      <Message>Veja os perfis da sua turma. Puxe a lista para atualizar.</Message>
      <Field label="Buscar jogador" value={search} onChangeText={setSearch} autoCorrect={false} returnKeyType="search" />
      {roster.isPending ? <Message>Carregando jogadores...</Message> : null}
      {roster.isError ? <><Message error>Não foi possível carregar a turma. Confira sua conexão e tente novamente.</Message><Action secondary onPress={() => { void roster.refetch(); }}>Tentar novamente</Action></> : null}
    </View>}
    ListEmptyComponent={!roster.isPending && !roster.isError ? <Message>{roster.data?.length ? 'Nenhum jogador encontrado.' : 'Ainda não há jogadores cadastrados nesta pelada.'}</Message> : undefined}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir perfil de ${item.name}`} onPress={() => router.push({ pathname: '/jogadores/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, { borderColor: colors.separator, backgroundColor: pressed ? colors.selected : 'transparent' }]}>
      <View style={styles.player}><Text style={[typography.label, { color: colors.foreground }]}>{item.name}{item.isOwnProfile ? ' · Você' : ''}</Text><Text style={[typography.detail, { color: colors.secondary }]}>{item.myRating == null ? 'Avaliação pendente' : `Sua nota: ${item.myRating}`}</Text></View>
      <Text accessibilityLabel={`Nota consolidada ${item.rating.toFixed(2)}`} style={[typography.label, { color: colors.foreground, fontVariant: ['tabular-nums'] }]}>{item.rating.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</Text>
    </Pressable>} />;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 24, width: '100%', maxWidth: 760, alignSelf: 'center' }, header: { gap: 20, paddingVertical: 20 }, account: { flexDirection: 'row', alignItems: 'center', gap: 16 }, row: { minHeight: 80, paddingVertical: 18, paddingHorizontal: 4, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 16 }, player: { flex: 1, gap: 6 } });
