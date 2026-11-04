import { useLocalSearchParams } from 'expo-router';
import { DrawResultScreen } from '../../../src/features/draws/draw-result-screen';

export default function DrawPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DrawResultScreen id={typeof id === 'string' ? id : ''} />;
}
