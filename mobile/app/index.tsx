import { Redirect } from 'expo-router';
import { Action, Loading, Message } from '../src/components/ui';
import { useAuth } from '../src/providers/auth-provider';
import { View } from 'react-native';

export default function Index() {
  const auth = useAuth();
  if (auth.status === 'loading') return <Loading label="Verificando seu acesso..." />;
  if (auth.status === 'error') return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 20 }}><Message error>{auth.error ?? 'Não foi possível verificar o acesso.'}</Message><Action onPress={() => { void auth.retry(); }}>Tentar novamente</Action></View>;
  return <Redirect href={auth.status === 'authenticated' ? '/jogadores' : '/entrar'} />;
}
