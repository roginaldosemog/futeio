import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '../../../src/features/players/profile-screen';

export default function PlayerProfile() {
  const params = useLocalSearchParams<{ id: string }>();
  return <ProfileScreen id={typeof params.id === 'string' ? params.id : ''} />;
}
