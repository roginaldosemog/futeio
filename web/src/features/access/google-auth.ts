export interface GoogleAuthConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
  emulatorHost?: string;
}

export interface GoogleLoginClient {
  signIn(): Promise<string>;
  clear(): Promise<void>;
  dispose(): Promise<void>;
}

// Only Auth is loaded. Firestore, Storage and authorization stay on the server.
export async function prepareGoogleLogin(config: GoogleAuthConfig): Promise<GoogleLoginClient> {
  const [appSdk, sdk] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const { emulatorHost, ...options } = config;
  const app = appSdk.initializeApp(options, `futeio-login-${crypto.randomUUID()}`);
  try {
    const auth = sdk.initializeAuth(app, {
      persistence: sdk.inMemoryPersistence,
      popupRedirectResolver: sdk.browserPopupRedirectResolver,
    });
    if (emulatorHost) sdk.connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    await auth.authStateReady();
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    let disposed = false;
    let disposal: Promise<void> | undefined;
    return {
      // Call immediately from the click handler to preserve the popup gesture.
      async signIn() {
        if (disposed) throw new Error("Login cancelled");
        const result = await sdk.signInWithPopup(auth, provider);
        if (disposed) throw new Error("Login cancelled");
        const token = await result.user.getIdToken();
        if (disposed) throw new Error("Login cancelled");
        return token;
      },
      async clear() { if (!disposed) await sdk.signOut(auth); },
      dispose() {
        disposed = true;
        disposal ??= (async () => { try { await sdk.signOut(auth); } finally { await appSdk.deleteApp(app); } })();
        return disposal;
      },
    };
  } catch (error) {
    await appSdk.deleteApp(app);
    throw error;
  }
}
