import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { Action, Field, Loading, Message } from '../../components/ui';
import { getApiConfigurationError } from '../../lib/config';
import { useAuth } from '../../providers/auth-provider';
import { typography, useTheme } from '../../theme';

export function LoginScreen() {
  const auth = useAuth();
  const colors = useTheme();
  const [mode, setMode] = useState<'player' | 'admin'>('player');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const configurationError = getApiConfigurationError();
  async function submit() {
    if (lock.current || configurationError) return;
    setError(undefined);
    if (mode === 'player' ? !link.trim() : !email.trim() || !password) {
      setError(mode === 'player' ? 'Cole o link pessoal enviado pelo administrador.' : 'Informe seu e-mail e sua senha.');
      return;
    }
    lock.current = true; setPending(true);
    try {
      if (mode === 'player') await auth.redeemLink(link.trim());
      else await auth.signIn(email.trim(), password);
    } catch (failure) {
      // The session controller rejects with the reason (credentials, rate
      // limit, connection). Show that one reason instead of a second guess.
      setError(failure instanceof Error && failure.message ? failure.message
        : mode === 'player' ? 'Não foi possível entrar. Confira seu link ou peça um novo ao administrador.' : 'Não foi possível entrar. Confira o e-mail e a senha e tente novamente.');
    } finally {
      setPassword(''); setLink(''); setPending(false); lock.current = false;
    }
  }
  if (auth.status === 'loading') return <Loading label="Verificando seu acesso..." />;
  if (auth.status === 'authenticated') return <Redirect href="/jogadores" />;
  // One message slot: what this form just reported, else why the session ended.
  const message = error ?? auth.error;
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text accessibilityRole="header" style={[typography.title, { color: colors.foreground }]}>Fute.io</Text>
        <Text style={[typography.body, { color: colors.secondary }]}>Sua turma, as avaliações e os times da pelada.</Text>
        {configurationError ? <Message error>{configurationError}</Message> : null}
        {auth.status === 'error' ? <Action secondary onPress={() => { void auth.retry(); }}>Verificar acesso novamente</Action> : null}
        <View style={styles.switcher}>
          <Action secondary={mode !== 'player'} disabled={pending} onPress={() => { setMode('player'); setError(undefined); setPassword(''); }}>Sou jogador</Action>
          <Action secondary={mode !== 'admin'} disabled={pending} onPress={() => { setMode('admin'); setError(undefined); setLink(''); }}>Sou administrador</Action>
        </View>
        <Text accessibilityRole="header" style={[typography.heading, { color: colors.foreground }]}>{mode === 'player' ? 'Entrar com seu link' : 'Acesso do administrador'}</Text>
        {mode === 'player' ? <>
          <Message>Use o link pessoal que o administrador compartilhou com você. Ele permite acessar seu perfil sem criar uma senha.</Message>
          <Field label="Link pessoal" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} secureTextEntry textContentType="none" editable={!pending} />
        </> : <>
          <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!pending} />
          <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" editable={!pending} onSubmitEditing={() => { void submit(); }} />
        </>}
        {message ? <Message error>{message}</Message> : null}
        <Action busy={pending} disabled={Boolean(configurationError)} onPress={() => { void submit(); }}>{pending ? 'Entrando...' : 'Entrar'}</Action>
        <Message>Perfis e avaliações são privados para os membros da pelada. Guarde seu link e compartilhe-o somente com o administrador quando precisar de ajuda.</Message>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 24, paddingBottom: 40, gap: 20, maxWidth: 620, width: '100%', alignSelf: 'center' }, switcher: { gap: 12, marginVertical: 8 } });
