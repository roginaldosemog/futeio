import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action, Message } from '../../components/ui';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';
import { formatDrawDate, formatNumber, listDraws } from './draws-client';

export function DrawHistoryScreen() {
  const auth = useAuth();
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const history = useQuery({ queryKey: ['draws', auth.session?.groupId, auth.session?.identityId], queryFn: ({ signal }) => listDraws(signal) });
  return <FlatList data={history.data ?? []} keyExtractor={draw => draw.id} contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom) }]}
    refreshControl={<RefreshControl refreshing={history.isFetching && !history.isPending} onRefresh={() => { void history.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
    ListHeaderComponent={<View style={styles.header}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>Sorteios da pelada</Text>
      <Message>Consulte os 50 sorteios mais recentes. Cada resultado mantém os nomes e as notas registrados naquele momento.</Message>
      {auth.session?.role === 'ADMIN' ? <Action onPress={() => router.push('/administracao/sorteios')}>Novo sorteio</Action> : null}
      {history.isPending ? <Message>Carregando sorteios...</Message> : null}
      {history.isError ? <><Message error>Não foi possível carregar o histórico. Confira a conexão e tente novamente.</Message><Action secondary onPress={() => { void history.refetch(); }}>Tentar novamente</Action></> : null}
    </View>}
    ListEmptyComponent={!history.isPending && !history.isError ? <Message>Ainda não há sorteios registrados.</Message> : undefined}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir sorteio de ${formatDrawDate(item.createdAt)}`}
      onPress={() => router.push({ pathname: '/sorteios/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, { borderColor: colors.separator, backgroundColor: pressed ? colors.selected : 'transparent' }]}>
      <Text style={[typography.label, { color: colors.foreground }]}>{formatDrawDate(item.createdAt)}</Text>
      <Text style={[typography.body, { color: colors.secondary }]}>4 times de 5 · Diferença entre somas: {formatNumber(item.spread)}</Text>
    </Pressable>} />;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 24, maxWidth: 760, width: '100%', alignSelf: 'center' }, header: { paddingVertical: 24, gap: 20 }, row: { minHeight: 80, gap: 8, paddingVertical: 20, borderBottomWidth: 1 } });
