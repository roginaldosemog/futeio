import { useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@futeio/contracts';
import { Action, Field, Message } from '../../components/ui';
import { AccessError, apiRequest } from '../../lib/api';
import { writeFailure } from '../../lib/write-outcome';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';
import { PrivateLinkReceipt } from './private-link-receipt';

type Player = components['schemas']['PlayerSummaryDto'];
type Created = components['schemas']['CreatePlayerResponseDto'];
type Receipt = { name: string; accessUrl: string | null };

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
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const lock = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  const ownExists = roster.data?.some(player => player.isOwnProfile) ?? false;

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        revision.current++;
        setReceipt(previous => previous ? { ...previous, accessUrl: null } : null);
      }
    });
    return () => { mounted.current = false; revision.current++; subscription.remove(); };
  }, []);

  async function save() {
    if (!admin || lock.current || blocked || !roster.data || roster.isError) return;
    const trimmedName = name.trim();
    const trimmedRating = rating.trim();
    const numericRating = Number(trimmedRating);
    if (!trimmedName || trimmedName.length > 100 || !/^\d+$/.test(trimmedRating) || !Number.isInteger(numericRating) || numericRating < 0 || numericRating > 10) {
      setError('Informe um nome de 1 a 100 caracteres e uma nota inteira de 0 a 10.');
      return;
    }
    lock.current = true;
    setPending(true);
    setError(undefined);
    const privacyRevision = revision.current;
    try {
      // Keep the returned credential out of TanStack's mutation/query caches.
      const result = await apiRequest<Created>('players', { method: 'POST', body: { name: trimmedName, initialRating: numericRating, linkToCurrentAdministrator: own && !ownExists } });
      if (mounted.current && privacyRevision === revision.current) {
        client.setQueryData<Player[]>(queryKey, (previous = []) => [...previous.filter(player => player.id !== result.player.id), result.player]);
      }
      // A retained roster must reconcile a confirmed POST even after Back or
      // backgrounding. Invalidate only the identity captured by this request;
      // a failed GET cannot change the confirmed creation into a failed POST.
      void client.invalidateQueries({ queryKey, exact: true }).catch(() => {});
      if (!mounted.current) return;
      setReceipt({ name: result.player.name, accessUrl: privacyRevision === revision.current ? result.accessUrl : null });
      setName(''); setRating(''); setOwn(false);
    } catch (failure) {
      if (!mounted.current) return;
      // An uncertain creation stays blocked until the roster is reconciled.
      setBlocked(writeFailure(failure) === 'uncertain');
      setError(failure instanceof AccessError && failure.status === 400
        ? 'Confira o nome e a nota inicial, de 0 a 10.'
        : failure instanceof AccessError && failure.status === 409
          ? 'Seu perfil já está cadastrado. Confira a lista e desmarque o vínculo ao administrador.'
          : 'Não foi possível confirmar o cadastro. Ele pode ter sido registrado. Atualize e confira a lista antes de tentar novamente.');
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }

  async function reviewRoster() {
    if (pending) return;
    const result = await roster.refetch();
    if (result.isSuccess) setBlocked(false);
  }

  if (!admin) return <View style={styles.content}><Message error>Somente o administrador pode cadastrar jogadores.</Message></View>;
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>Cadastrar jogador</Text>
      {receipt ? <View style={styles.section}>
        <Message>Cadastro confirmado: {receipt.name}.</Message>
        {receipt.accessUrl ? <PrivateLinkReceipt url={receipt.accessUrl} onHide={() => setReceipt(previous => previous ? { ...previous, accessUrl: null } : null)} />
          : <Message>O link foi ocultado. Para permitir outra entrada, gere um novo link no perfil do jogador.</Message>}
        <Action onPress={() => { setReceipt(null); setError(undefined); }}>Cadastrar outro jogador</Action>
      </View> : <View style={styles.section}>
        <Message>A nota inicial é obrigatória. O jogador pode acessar pelo link pessoal, sem informar e-mail.</Message>
        <Field label="Nome do jogador" value={name} onChangeText={setName} maxLength={100} editable={!pending} autoCapitalize="words" />
        <Field label="Nota inicial, de 0 a 10" value={rating} onChangeText={setRating} maxLength={3} keyboardType="number-pad" editable={!pending} />
        <View style={styles.switchRow}><Text style={[typography.body, { color: colors.foreground, flex: 1 }]}>Este é o meu perfil</Text>
          <Switch accessibilityLabel="Este é o meu perfil" accessibilityState={{ disabled: pending || ownExists || !roster.data }} value={own && !ownExists} onValueChange={setOwn} disabled={pending || ownExists || !roster.data} trackColor={{ true: colors.primary }} />
        </View>
        {ownExists ? <Message>Seu perfil de jogador já está cadastrado.</Message> : null}
        {error ? <Message error>{error}</Message> : null}
        <Action busy={pending} disabled={blocked || !roster.data || roster.isError} onPress={() => { void save(); }}>{pending ? 'Cadastrando...' : 'Confirmar cadastro'}</Action>
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
