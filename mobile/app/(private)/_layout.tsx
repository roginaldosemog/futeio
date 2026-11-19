import { Redirect, Stack } from 'expo-router';
import { Loading } from '../../src/components/ui';
import { useAuth } from '../../src/providers/auth-provider';
import { useTheme } from '../../src/theme';

export default function PrivateLayout() {
  const auth = useAuth();
  const colors = useTheme();
  if (auth.status === 'loading') return <Loading label="Verificando seu acesso..." />;
  if (auth.status === 'error') return <Redirect href="/" />;
  if (auth.status !== 'authenticated') return <Redirect href="/entrar" />;
  return <Stack screenOptions={{ headerTintColor: colors.foreground, headerStyle: { backgroundColor: colors.background }, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="jogadores/index" options={{ title: 'Fute.io', headerLargeTitle: true }} />
    <Stack.Screen name="jogadores/[id]" options={{ title: 'Perfil do jogador', headerBackTitle: 'Jogadores' }} />
    <Stack.Screen name="administracao/jogadores" options={{ title: 'Cadastrar jogador' }} />
    <Stack.Screen name="administracao/sorteios" options={{ title: 'Montar os times' }} />
    <Stack.Screen name="sorteios/index" options={{ title: 'Sorteios', headerLargeTitle: true }} />
    <Stack.Screen name="sorteios/[id]" options={{ title: 'Times sorteados' }} />
  </Stack>;
}
