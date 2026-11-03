"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccessError, currentSession, logout } from "./access-client";
import type { SessionResponse } from "./access-client";
import { AdminSessionPanel } from "./admin-session-panel";

export function Administration() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    currentSession(controller.signal)
      .then((current) => {
        if (controller.signal.aborted) return;
        if (current.role !== "ADMIN") {
          router.replace("/entrar");
          return;
        }
        setSession(current);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof AccessError && error.status === 401) {
          router.replace("/entrar");
          return;
        }
        setLoadError(true);
      });
    return () => controller.abort();
  }, [attempt, router]);

  async function handleLogout() {
    setPending(true);
    setErrorMessage(undefined);
    try {
      await logout();
      router.replace("/entrar");
    } catch (error) {
      if (error instanceof AccessError && error.status === 401) {
        router.replace("/entrar");
      } else {
        setErrorMessage(
          error instanceof AccessError && error.status === 429
            ? "Muitas tentativas. Aguarde alguns minutos e tente sair novamente."
            : "Não foi possível sair. Tente novamente em instantes.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <p className="text-base leading-relaxed text-[#8b3028]" role="alert">
          Não foi possível verificar seu acesso. Tente novamente em instantes.
        </p>
        <button
          className="mt-6 min-h-12 rounded-xl border border-[#6b8576] px-5 py-3 font-semibold transition-colors hover:bg-[#e7efea] motion-reduce:transition-none"
          type="button"
          onClick={() => {
            setLoadError(false);
            setAttempt((current) => current + 1);
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!session) {
    return <p className="text-base leading-relaxed text-[#3c5b4b]" role="status">Verificando seu acesso...</p>;
  }

  return (
    <AdminSessionPanel
      email={session.email}
      onLogout={handleLogout}
      pending={pending}
      errorMessage={errorMessage}
    />
  );
}
