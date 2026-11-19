import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action, Loading, Message } from '../../components/ui';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';
import { formatDrawDate, formatNumber, getDraw } from './draws-client';

export function DrawResultScreen({ id }: { id: string }) {
  const auth = useAuth();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState(false);
  const result = useQuery({ queryKey: ['draw', auth.session?.groupId, auth.session?.identityId, id], queryFn: ({ signal }) => getDraw(id, signal), enabled: Boolean(id) });
  if (!id || result.isError) return <View style={styles.content}><Message error>Não foi possível abrir este sorteio. Ele pode não estar disponível no seu grupo.</Message>{id ? <Action secondary onPress={() => { void result.refetch(); }}>Tentar novamente</Action> : null}</View>;
  if (result.isPending) return <Loading label="Carregando sorteio..." />;
  const draw = result.data;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, { paddingBottom: Math.max(40, insets.bottom) }]}>
    <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>Times sorteados</Text>
    <Message>{formatDrawDate(draw.createdAt)}</Message>
    <Message>Este é o registro do sorteio. Mudanças posteriores nos perfis e nas avaliações não alteram estes times.</Message>
    {draw.teams.map(team => <View key={team.number} style={[styles.team, { borderColor: colors.separator }]}>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>Time {team.number}</Text>
      {team.players.map(player => <View key={player.id} style={styles.player}>
        <Text style={[typography.body, { color: colors.foreground, flex: 1 }]}>{player.name}</Text>
        <Text accessibilityLabel={`Nota de ${player.name}: ${formatNumber(player.rating)}`} style={[typography.label, { color: colors.foreground, fontVariant: ['tabular-nums'] }]}>{formatNumber(player.rating)}</Text>
      </View>)}
      <Text style={[typography.label, { color: colors.secondary }]}>Soma: {formatNumber(team.total)} · Média: {formatNumber(team.average)}</Text>
    </View>)}
    <Text style={[typography.label, { color: colors.foreground }]}>Diferença entre somas: {formatNumber(draw.spread)}</Text>
    <Message>O servidor procura aproximar a força dos quatro times usando as notas. O resultado é uma heurística; não garante o melhor equilíbrio possível nem prevê o desempenho em campo.</Message>
    <Action secondary onPress={() => setDetails(value => !value)}>{details ? 'Ocultar detalhes do sorteio' : 'Ver detalhes do sorteio'}</Action>
    {details ? <>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>Como este resultado foi registrado</Text>
      <Message>Algoritmo: {draw.algorithmVersion}{'\n'}Cálculo das notas: {draw.calculationVersion}{'\n'}Semente: {draw.seed}</Message>
      <Message>As versões, a semente e as notas capturadas permitem explicar e reproduzir o sorteio no servidor. Os valores são apresentados com até duas casas decimais; o cálculo usa as notas sem esse arredondamento.</Message>
    </> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { padding: 24, gap: 20, maxWidth: 760, width: '100%', alignSelf: 'center' }, team: { gap: 16, borderTopWidth: 1, paddingTop: 24 }, player: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 16 } });
