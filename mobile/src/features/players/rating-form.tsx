import { useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Action, Field, Message } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { typography, useTheme } from '../../theme';

export function RatingForm({ id, current, own }: { id: string; current?: number; own: boolean }) {
  const colors = useTheme();
  const client = useQueryClient();
  const [value, setValue] = useState(current?.toString() ?? '');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const locked = useRef(false);

  async function save() {
    if (locked.current) return;
    setError(undefined); setNotice(undefined);
    if (!/^(?:[0-9]|10)$/.test(value.trim())) { setError('Escolha uma nota inteira de 0 a 10.'); return; }
    locked.current = true; setPending(true);
    try {
      await apiRequest(`players/${id}/evaluations`, { method: 'POST', body: { rating: Number(value.trim()) } });
      setNotice('Avaliação salva. Sua contribuição anterior foi substituída.');
      // Refresh failures must not turn a confirmed write into a failed save.
      void client.invalidateQueries({ queryKey: ['evaluations'] });
      void client.invalidateQueries({ queryKey: ['profile'] });
      void client.invalidateQueries({ queryKey: ['players'] });
    } catch { setError('Não foi possível confirmar sua avaliação. Atualize o perfil antes de tentar novamente.'); }
    finally { locked.current = false; setPending(false); }
  }

  return <View style={{ gap: 16 }}>
    <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>{own ? 'Sua autoavaliação' : 'Avaliar jogador'}</Text>
    <Message>{current === undefined ? 'Você ainda não avaliou este jogador.' : `Sua nota vigente: ${current}. Uma nova nota substitui a anterior.`}</Message>
    <Field label="Sua nota, de 0 a 10" value={value} onChangeText={setValue} keyboardType="number-pad" maxLength={3} editable={!pending} />
    {error ? <Message error>{error}</Message> : null}
    {notice ? <Message>{notice}</Message> : null}
    <Action busy={pending} onPress={() => { void save(); }}>Salvar avaliação</Action>
  </View>;
}
