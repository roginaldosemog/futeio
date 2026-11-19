import { Image, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { privatePhoto } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { Action, Message } from '../../components/ui';

export function PrivatePhoto({ url, name }: { url: string; name: string }) {
  const { session } = useAuth();
  const image = useQuery({
    queryKey: ['photo', session?.groupId, session?.identityId, url],
    queryFn: ({ signal }) => privatePhoto(url, signal),
    gcTime: 0,
  });
  return <View style={{ gap: 12 }}>
    {image.data && !image.isError ? <Image accessibilityLabel={`Foto de ${name}`} source={{ uri: image.data }} style={{ width: 128, height: 128, borderRadius: 12 }} /> : null}
    {image.isPending ? <Message>Carregando foto...</Message> : null}
    {image.isError ? <><Message error>Não foi possível carregar a foto.</Message><Action secondary onPress={() => { void image.refetch(); }}>Tentar carregar foto</Action></> : null}
  </View>;
}
