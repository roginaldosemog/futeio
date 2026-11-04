import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { nativeApi } from '../lib/api';
import { SessionController } from '../lib/session-controller';
import { sessionStore } from '../lib/session-store';
import { AuthProvider } from './auth-provider';

export function AppProviders({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false, gcTime: 0 },
  } }));
  const [auth] = useState(() => new SessionController(nativeApi, sessionStore, () => { void client.cancelQueries(); client.clear(); }));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
      if (state !== 'active') {
        // Private responses stay in memory only; clear on leaving the app.
        void client.cancelQueries();
        client.clear();
      } else {
        if (auth.getSnapshot().status !== 'anonymous') void auth.initialize();
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
    return () => { mounted = false; subscription.remove(); network.remove(); void client.cancelQueries(); client.clear(); };
  }, [auth, client]);

  return <SafeAreaProvider><QueryClientProvider client={client}><AuthProvider controller={auth}>{children}</AuthProvider></QueryClientProvider></SafeAreaProvider>;
}
