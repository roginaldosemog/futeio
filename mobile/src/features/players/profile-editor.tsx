import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Action, Field, Message } from '../../components/ui';
import { apiRequest, AccessError } from '../../lib/api';
import { useTheme, typography } from '../../theme';
import { selectProfilePhoto } from './photo-selection';
import { useAuth } from '../../providers/auth-provider';

export function ProfileEditor({ id, name: initialName, hasPhoto }: { id: string; name: string; hasPhoto: boolean }) {
  const client = useQueryClient();
  const colors = useTheme();
  const { session } = useAuth();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [remove, setRemove] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function perform(action: 'name' | 'photo' | 'remove') {
    if (locked.current) return;
    setError(undefined); setNotice(undefined);
    if (action === 'name' && (!name.trim() || name.trim().length > 100)) { setError('Informe um nome com até 100 caracteres.'); return; }
    locked.current = true; setPending(true);
    const scope = [session?.groupId, session?.identityId];
    try {
      if (action === 'photo') {
        const data = await selectProfilePhoto();
        if (!data || !mounted.current) return;
        await apiRequest(`players/${id}/photo`, { method: 'POST', body: { data } });
      } else if (action === 'remove') {
        await apiRequest(`players/${id}/photo`, { method: 'DELETE' });
        setRemove(false);
      } else await apiRequest(`players/${id}/profile`, { method: 'POST', body: { name: name.trim() } });
      void client.invalidateQueries({ queryKey: ['profile', ...scope, id] });
      void client.invalidateQueries({ queryKey: ['players', ...scope] });
      void client.invalidateQueries({ queryKey: ['photo', ...scope] });
      void client.invalidateQueries({ queryKey: ['evaluations', ...scope] });
      if (!mounted.current) return;
      setNotice(action === 'name' ? 'Nome salvo.' : action === 'remove' ? 'Foto removida.' : 'Foto salva.');
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure instanceof AccessError && failure.status === 429
        ? 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
        : 'Não foi possível confirmar a alteração. Atualize o perfil e tente novamente.');
    } finally { locked.current = false; if (mounted.current) setPending(false); }
  }

  return <View style={{ gap: 16 }}>
    <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>Editar perfil</Text>
    <Field label="Nome do jogador" value={name} onChangeText={setName} maxLength={100} autoCapitalize="words" editable={!pending} />
    <Action busy={pending} onPress={() => { void perform('name'); }}>Salvar nome</Action>
    <Action secondary disabled={pending} onPress={() => { void perform('photo'); }}>Escolher foto</Action>
    <Message>A foto escolhida é reduzida antes do envio. Ela fica disponível somente aos membros da pelada.</Message>
    {hasPhoto && !remove ? <Action secondary disabled={pending} onPress={() => setRemove(true)}>Remover foto</Action> : null}
    {remove ? <View style={{ gap: 12 }}><Message>Remover a foto deste perfil?</Message><Action busy={pending} onPress={() => { void perform('remove'); }}>Confirmar remoção</Action><Action secondary disabled={pending} onPress={() => setRemove(false)}>Cancelar</Action></View> : null}
    {notice ? <Message>{notice}</Message> : null}
    {error ? <Message error>{error}</Message> : null}
  </View>;
}
