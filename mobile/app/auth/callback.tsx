import { Redirect } from 'expo-router';
import { Loading } from '../../src/components/ui';
import { useAuth } from '../../src/providers/auth-provider';

export default function NativeCallback() {
  const auth = useAuth();
  if (auth.status === 'authorizing' || auth.status === 'loading') return <Loading label="Confirmando o acesso ao aplicativo..." />;
  return <Redirect href={auth.status === 'authenticated' ? '/jogadores' : '/entrar'} />;
}
