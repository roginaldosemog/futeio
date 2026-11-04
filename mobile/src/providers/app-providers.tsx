import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { nativeApi } from '../lib/api';
import { SessionController } from '../lib/session-controller';
import { sessionStore } from '../lib/session-store';
import { AuthProvider } from './auth-provider';
import { useTheme } from '../theme';

export function AppProviders({ children }: PropsWithChildren) {
  const colors = useTheme();
  const [covered, setCovered] = useState(AppState.currentState !== 'active' && AppState.currentState !== null);
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0, networkMode: 'always', refetchOnReconnect: true, refetchOnWindowFocus: false },
    mutations: { retry: false, gcTime: 0, networkMode: 'always' },
  } }));
  const [auth] = useState(() => new SessionController(nativeApi, sessionStore, () => { void client.cancelQueries(); client.clear(); }));

  useEffect(() => {
    let resumeRevision = 0;
    const subscription = AppState.addEventListener('change', (state) => {
      const revision = ++resumeRevision;
      if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
      if (state !== 'active') {
        setCovered(true);
        // Native pickers/share sheets must not unmount active forms. Preserve
        // their in-memory data behind the cover until session validation.
        void client.cancelQueries();
      } else {
        if (auth.getSnapshot().status === 'authenticated') {
          void auth.revalidate().finally(() => {
            if (revision !== resumeRevision) return;
            if (auth.getSnapshot().status === 'authenticated') void client.invalidateQueries();
            setCovered(false);
          });
        } else {
          setCovered(false);
          if (auth.getSnapshot().status !== 'anonymous') void auth.initialize();
        }
      }
    });
    let receivedNetworkEvent = false;
    const network = Network.addNetworkStateListener((state) => {
      receivedNetworkEvent = true;
      onlineManager.setOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    let mounted = true;
    void Network.getNetworkStateAsync().then((state) => {
      if (mounted && !receivedNetworkEvent) onlineManager.setOnline(state.isConnected === true && state.isInternetReachable !== false);
    }).catch(() => {});
    return () => { mounted = false; resumeRevision++; subscription.remove(); network.remove(); void client.cancelQueries(); client.clear(); };
  }, [auth, client]);

  return <SafeAreaProvider><QueryClientProvider client={client}><AuthProvider controller={auth}>
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }} accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {covered ? <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: colors.foreground, fontSize: 24 }}>Fute.io</Text></View> : null}
    </View>
  </AuthProvider></QueryClientProvider></SafeAreaProvider>;
}
