import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action, Field, Loading, Message } from '../../components/ui';
import { AccessError } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';
import { createDraw, formatNumber, listParticipants } from './draws-client';

type DrawOperation = { playerIds: string[]; groupId: string; identityId: string; scope: string; generation: number };

function DrawCreationContent() {
  const auth = useAuth();
  const colors = useTheme();
  const router = useRouter();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const lock = useRef(false);
  const groupId = auth.session?.groupId;
  const identityId = auth.session?.identityId;
  const scope = `${groupId}:${identityId}`;
  const lifecycle = useRef({ scope, focused: false, generation: 0 });
  useLayoutEffect(() => {
    lifecycle.current.scope = scope;
    return () => { lifecycle.current.focused = false; lifecycle.current.generation++; };
  }, [scope]);
  useFocusEffect(useCallback(() => {
    lifecycle.current.focused = true;
    return () => { lifecycle.current.focused = false; lifecycle.current.generation++; };
  }, [scope]));
  function isCurrent(operation: { scope: string; generation: number }) {
    return lifecycle.current.focused && lifecycle.current.scope === operation.scope && lifecycle.current.generation === operation.generation;
  }
  const roster = useQuery({ queryKey: ['players', auth.session?.groupId, auth.session?.identityId], queryFn: ({ signal }) => listParticipants(signal) });
  const creation = useMutation({
    mutationFn: (operation: DrawOperation) => createDraw(operation.playerIds), retry: false, gcTime: 0, networkMode: 'always',
    onSuccess: (draw, operation) => {
      void client.invalidateQueries({ queryKey: ['draws', operation.groupId, operation.identityId] });
      if (!isCurrent(operation)) return;
      router.replace({ pathname: '/sorteios/[id]', params: { id: draw.id } });
    },
  });
  const uncertain = creation.isError && (!(creation.error instanceof AccessError) || creation.error.status >= 500 || creation.error.status === 429);
  async function submit() {
    if (!groupId || !identityId || !lifecycle.current.focused || selected.size !== 20 || lock.current || creation.isPending || creation.isSuccess || uncertain) return;
    lock.current = true;
    const operation = { playerIds: [...selected], groupId, identityId, scope, generation: lifecycle.current.generation };
    try { await creation.mutateAsync(operation); }
    catch (error) {
      // Confirmed/ambiguous outcomes stay locked even before the observer's
      // next render. A rejected input may be corrected and submitted again.
      if (error instanceof AccessError && error.status < 500 && error.status !== 429) lock.current = false;
    }
  }
  function toggle(id: string) {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < 20) next.add(id);
      return next;
    });
  }
  if (roster.isPending) return <Loading label="Carregando jogadores..." />;
  if (roster.isError) return <View style={styles.content}><Message error>Não foi possível carregar os jogadores.</Message><Action secondary onPress={() => { void roster.refetch(); }}>Tentar novamente</Action></View>;
  const visible = roster.data.filter(player => player.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
  return <FlatList data={visible} keyExtractor={player => player.id} initialNumToRender={24} contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={[styles.content, { paddingBottom: Math.max(32, insets.bottom) }]} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<View style={styles.header}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>Montar os times</Text>
      <Message>Selecione exatamente 20 jogadores de linha para formar 4 times de 5. Os goleiros ficam de fora. O sorteio usa as notas atuais do grupo.</Message>
      {roster.data.length < 20 ? <Message>Há {roster.data.length} jogadores cadastrados. Cadastre pelo menos 20 para sortear.</Message> : null}
      <Field label="Buscar participante" value={search} onChangeText={setSearch} autoCorrect={false} editable={!creation.isPending} />
      <Text accessibilityLiveRegion="polite" style={[typography.label, { color: colors.foreground }]}>{selected.size} de 20 selecionados</Text>
    </View>}
    ListEmptyComponent={<Message>Nenhum jogador encontrado.</Message>}
    renderItem={({ item }) => {
      const checked = selected.has(item.id);
      const disabled = creation.isPending || creation.isSuccess || uncertain || (!checked && selected.size === 20);
      return <Pressable accessibilityRole="checkbox" accessibilityLabel={item.name} accessibilityState={{ checked, disabled }} disabled={disabled}
        onPress={() => toggle(item.id)} style={({ pressed }) => [styles.row, { borderColor: colors.separator, backgroundColor: checked ? colors.selected : pressed ? colors.surface : 'transparent', opacity: disabled && !checked ? 0.5 : 1 }]}>
        <View style={styles.name}><Text style={[typography.label, { color: colors.foreground }]}>{item.name}</Text><Text style={[typography.detail, { color: colors.secondary }]}>{checked ? 'Selecionado' : 'Não selecionado'}</Text></View>
        <Text style={[typography.label, { color: colors.foreground, fontVariant: ['tabular-nums'] }]}>{formatNumber(item.rating)}</Text>
      </Pressable>;
    }}
    ListFooterComponent={<View style={styles.footer}>
      <Action disabled={selected.size !== 20 || creation.isSuccess || uncertain} busy={creation.isPending} onPress={() => { void submit(); }}>{creation.isPending ? 'Montando os times...' : 'Sortear 4 times'}</Action>
      <Action secondary disabled={!selected.size || creation.isPending || creation.isSuccess || uncertain} onPress={() => setSelected(new Set())}>Limpar seleção</Action>
      {creation.isSuccess ? <><Message>Sorteio registrado. Abra o resultado ou consulte o histórico antes de montar outros times.</Message><Action secondary onPress={() => { if (lifecycle.current.focused) router.replace({ pathname: '/sorteios/[id]', params: { id: creation.data.id } }); }}>Ver resultado</Action></> : null}
      {creation.isError ? <Message error>{creation.error instanceof AccessError && creation.error.status === 400 ? 'Confira a seleção: são necessários 20 jogadores distintos do grupo.' : 'Não foi possível confirmar o sorteio. Confira o histórico antes de tentar novamente; ele pode ter sido registrado.'}</Message> : null}
      {uncertain ? <Action secondary onPress={() => router.replace('/sorteios')}>Conferir histórico</Action> : null}
    </View>} />;
}

export function DrawCreationScreen() {
  const auth = useAuth();
  if (auth.session?.role !== 'ADMIN') return <View style={styles.content}><Message error>Somente o administrador pode criar sorteios.</Message></View>;
  return <DrawCreationContent key={`${auth.session.groupId}:${auth.session.identityId}`} />;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 24, paddingVertical: 24, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' }, header: { gap: 20, paddingBottom: 12 }, row: { minHeight: 80, paddingVertical: 16, paddingHorizontal: 8, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 16 }, name: { flex: 1, gap: 6 }, footer: { paddingTop: 24, gap: 16 } });
