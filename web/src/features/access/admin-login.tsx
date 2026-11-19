"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccessError, googleLoginErrorMessage, loginAdministrator, loginAdministratorWithGoogle, loginErrorMessage } from "./access-client";
import { AdminLoginForm } from "./admin-login-form";
import { prepareGoogleLogin, type GoogleAuthConfig, type GoogleLoginClient } from "./google-auth";

export function AdminLogin({ googleConfig, onAuthenticated }: { googleConfig?: GoogleAuthConfig; onAuthenticated?: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [googleState, setGoogleState] = useState<"loading" | "ready" | "failed">("loading");
  const googleClient = useRef<GoogleLoginClient | undefined>(undefined);
  const googleGeneration = useRef({ cancelled: false });
  const [googleAttempt, setGoogleAttempt] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!googleConfig) return;
    const generation = { cancelled: false };
    googleGeneration.current = generation;
    let cancelled = false;
    let client: GoogleLoginClient | undefined;
    void prepareGoogleLogin(googleConfig).then(async (prepared) => {
      if (cancelled) { await prepared.dispose(); return; }
      client = prepared;
      googleClient.current = prepared;
      setGoogleState("ready");
    }).catch(() => { if (!cancelled) setGoogleState("failed"); });
    return () => {
      cancelled = true;
      generation.cancelled = true;
      googleClient.current = undefined;
      void client?.dispose().catch(() => undefined);
    };
  }, [googleConfig, googleAttempt]);

  async function handleGoogleLogin() {
    if (pending) return;
    if (googleState === "failed") {
      setGoogleState("loading");
      setGoogleAttempt((attempt) => attempt + 1);
      return;
    }
    const client = googleClient.current;
    if (!client) return;
    const generation = googleGeneration.current;
    const isCurrent = () => !generation.cancelled && googleClient.current === client;
    setPending(true);
    setErrorMessage(undefined);
    try {
      const token = await client.signIn();
      if (!isCurrent()) return;
      const session = await loginAdministratorWithGoogle(token);
      if (!isCurrent()) return;
      if (session.role !== "ADMIN") throw new AccessError(403);
      if (onAuthenticated) onAuthenticated();
      else router.replace("/administracao");
    } catch (error) {
      if (isCurrent()) setErrorMessage(googleLoginErrorMessage(error));
    } finally {
      await client.clear().catch(() => undefined);
      if (isCurrent()) setPending(false);
    }
  }

  async function handleLogin(email: string, password: string) {
    setPending(true);
    setErrorMessage(undefined);
    try {
      const session = await loginAdministrator(email, password);
      if (!mounted.current) return false;
      if (session.role !== "ADMIN") throw new AccessError(403);
      if (onAuthenticated) onAuthenticated();
      else router.replace("/administracao");
      return true;
    } catch (error) {
      if (mounted.current) setErrorMessage(loginErrorMessage(error));
      return false;
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  return <AdminLoginForm onSubmit={handleLogin} pending={pending} errorMessage={errorMessage}
    onGoogleLogin={googleConfig ? handleGoogleLogin : undefined} googleState={googleState} />;
}
