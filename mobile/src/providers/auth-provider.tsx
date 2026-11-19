import { createContext, useContext, useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { SessionController } from '../lib/session-controller';

const AuthContext = createContext<SessionController | null>(null);

export function AuthProvider({ controller, children }: PropsWithChildren<{ controller: SessionController }>) {
  useEffect(() => { const disconnect = controller.connect(); void controller.initialize(); return disconnect; }, [controller]);
  return <AuthContext.Provider value={controller}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const controller = useContext(AuthContext);
  if (!controller) throw new Error('AuthProvider ausente.');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return {
    ...state,
    signIn: controller.signIn,
    signInWithGoogle: controller.signInWithGoogle,
    redeemLink: controller.redeemLink,
    signOut: () => controller.signOut(),
    retry: () => controller.initialize(),
  };
}
