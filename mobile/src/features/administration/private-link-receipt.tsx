import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Action, Message } from '../../components/ui';
import { typography, useTheme } from '../../theme';

export function PrivateLinkReceipt({ url, onHide }: { url: string; onHide: () => void }) {
  const colors = useTheme();
  const [sharing, setSharing] = useState(false);
  const [failed, setFailed] = useState(false);
  async function share() {
    if (sharing) return;
    setSharing(true);
    setFailed(false);
    try { await Share.share({ message: url }); }
    catch { setFailed(true); }
    finally { setSharing(false); }
  }
  return <View style={styles.receipt}>
    <Message>Link pessoal: compartilhe individualmente. Quem tiver este link poderá acessar o perfil do jogador.</Message>
    <Text selectable style={[typography.detail, { color: colors.foreground }]}>{url}</Text>
    <Action busy={sharing} onPress={() => { void share(); }}>Compartilhar link pessoal</Action>
    <Action secondary disabled={sharing} onPress={onHide}>Ocultar link</Action>
    {failed ? <Message error>Não foi possível abrir o compartilhamento. Você pode selecionar o link e copiar manualmente.</Message> : null}
  </View>;
}

const styles = StyleSheet.create({ receipt: { gap: 16 } });
