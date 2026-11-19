import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '../src/providers/app-providers';
import { useTheme } from '../src/theme';

export default function RootLayout() {
  const colors = useTheme();
  return <AppProviders><StatusBar style="auto" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} /></AppProviders>;
}
