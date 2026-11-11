import { useEffect, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@futeio/contracts';
import { Action, Field, Message } from '../../components/ui';
import { AccessError, apiRequest } from '../../lib/api';
import { useMachine } from '../../lib/machine';
import { writeFailure } from '../../lib/write-outcome';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';
import { initialPlayerCreation, playerCreationTransition, type PlayerCreationState } from './player-creation-machine';
import { PrivateLinkReceipt } from './private-link-receipt';

type Player = components['schemas']['PlayerSummaryDto'];
type Created = components['schemas']['CreatePlayerResponseDto'];

const uncertainMessage = 'Não foi possível confirmar o cadastro. Ele pode ter sido registrado. Atualize e confira a lista antes de tentar novamente.';
function problem(state: PlayerCreationState): string | undefined {
  if (state.status === 'editing') return state.invalid ? 'Informe um nome de 1 a 100 caracteres e uma nota inteira de 0 a 10.' : undefined;
  if (state.status === 'uncertain') return uncertainMessage;
  if (state.status !== 'rejected') return undefined;
  if (state.reason === 'invalid') return 'Confira o nome e a nota inicial, de 0 a 10.';
  if (state.reason === 'conflict') return 'Seu perfil já está cadastrado. Confira a lista e desmarque o vínculo ao administrador.';
  return uncertainMessage;
}

export function PlayerCreationScreen() {
  const { session } = useAuth();
  const colors = useTheme();
  const client = useQueryClient();
  const admin = session?.role === 'ADMIN';
  const queryKey = ['players', session?.groupId, session?.identityId];
  const roster = useQuery({ queryKey, queryFn: ({ signal }) => apiRequest<Player[]>('players', { signal }), enabled: admin });
  const [name, setName] = useState('');
  const [rating, setRating] = useState('');
  const [own, setOwn] = useState(false);
  const [state, send] = useMachine(playerCreationTransition, initialPlayerCreation);
  const ownExists = roster.data?.some(player => player.isOwnProfile) ?? false;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') send({ type: 'conceal' }); });
    // Leaving the screen conceals too: a late response never stores a link.
    return () => { send({ type: 'conceal' }); subscription.remove(); };
  }, [send]);

  async function save() {
    if (!admin || !roster.data || roster.isError) return;
    const trimmedName = name.trim();
    const trimmedRating = rating.trim();
    const numericRating = Number(trimmedRating);
    if (!trimmedName || trimmedName.length > 100 || !/^\d+$/.test(trimmedRating) || !Number.isInteger(numericRating) || numericRating < 0 || numericRating > 10) {
      send({ type: 'invalid' });
      return;
    }
    // The machine is the lock: it ignores a submission while one is in flight
    // or while an uncertain result has not been reconciled with the roster.
    if (!send({ type: 'submit' })) return;
    let result: Created;
    try {
      // Keep the returned credential out of TanStack's mutation/query caches.
      result = await apiRequest<Created>('players', { method: 'POST', body: { name: trimmedName, initialRating: numericRating, linkToCurrentAdministrator: own && !ownExists } });
    } catch (failure) {
      if (writeFailure(failure) === 'uncertain') send({ type: 'uncertain' });
      else send({ type: 'rejected', reason: failure instanceof AccessError && failure.status === 400 ? 'invalid' : failure instanceof AccessError && failure.status === 409 ? 'conflict' : 'other' });
      return;
    }
    const settled = send({ type: 'created', name: result.player.name, accessUrl: result.accessUrl });
    // Concealed (backgrounded or left the screen): the invalidation below
    // reconciles the roster instead of this screen writing to the cache.
    if (settled?.status === 'created' && settled.accessUrl !== null) {
      client.setQueryData<Player[]>(queryKey, (previous = []) => [...previous.filter(player => player.id !== result.player.id), result.player]);
    }
    // A retained roster must reconcile a confirmed POST even after Back or
    // backgrounding. Invalidate only the identity captured by this request;
    // a failed GET cannot change the confirmed creation into a failed POST.
    void client.invalidateQueries({ queryKey, exact: true }).catch(() => {});
    setName(''); setRating(''); setOwn(false);
  }

  async function reviewRoster() {
    if (state.status === 'submitting') return;
    const result = await roster.refetch();
    if (result.isSuccess) send({ type: 'reviewed' });
  }

  const pending = state.status === 'submitting';
  const error = problem(state);
  if (!admin) return <View style={styles.content}><Message error>Somente o administrador pode cadastrar jogadores.</Message></View>;
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>Cadastrar jogador</Text>
      {state.status === 'created' ? <View style={styles.section}>
        <Message>Cadastro confirmado: {state.name}.</Message>
        {state.accessUrl ? <PrivateLinkReceipt url={state.accessUrl} onHide={() => { send({ type: 'hide' }); }} />
          : <Message>O link foi ocultado. Para permitir outra entrada, gere um novo link no perfil do jogador.</Message>}
        <Action onPress={() => { send({ type: 'next' }); }}>Cadastrar outro jogador</Action>
      </View> : <View style={styles.section}>
        <Message>A nota inicial é obrigatória. O jogador pode acessar pelo link pessoal, sem informar e-mail.</Message>
        <Field label="Nome do jogador" value={name} onChangeText={setName} maxLength={100} editable={!pending} autoCapitalize="words" />
        <Field label="Nota inicial, de 0 a 10" value={rating} onChangeText={setRating} maxLength={3} keyboardType="number-pad" editable={!pending} />
        <View style={styles.switchRow}><Text style={[typography.body, { color: colors.foreground, flex: 1 }]}>Este é o meu perfil</Text>
          <Switch accessibilityLabel="Este é o meu perfil" accessibilityState={{ disabled: pending || ownExists || !roster.data }} value={own && !ownExists} onValueChange={setOwn} disabled={pending || ownExists || !roster.data} trackColor={{ true: colors.primary }} />
        </View>
        {ownExists ? <Message>Seu perfil de jogador já está cadastrado.</Message> : null}
        {error ? <Message error>{error}</Message> : null}
        {state.status === 'reviewed' ? <Message>Lista atualizada. Confira se o jogador já aparece nela antes de cadastrar novamente.</Message> : null}
        <Action busy={pending} disabled={state.status === 'uncertain' || !roster.data || roster.isError} onPress={() => { void save(); }}>{pending ? 'Cadastrando...' : 'Confirmar cadastro'}</Action>
      </View>}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>Jogadores cadastrados</Text>
        {roster.isPending ? <Message>Carregando jogadores...</Message> : null}
        {roster.isError ? <Message error>Não foi possível atualizar a lista. Confira a conexão e tente novamente.</Message> : null}
        <Action secondary busy={roster.isFetching} disabled={pending} onPress={() => { void reviewRoster(); }}>Atualizar e conferir lista</Action>
        {roster.data?.map(player => <Text key={player.id} style={[typography.body, { color: colors.foreground }]}>{player.name}{player.isOwnProfile ? ' · Você' : ''}</Text>)}
        {roster.data?.length === 0 ? <Message>Ainda não há jogadores cadastrados.</Message> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 24, paddingBottom: 48, gap: 32, width: '100%', maxWidth: 760, alignSelf: 'center' }, section: { gap: 20 }, switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 16 } });
