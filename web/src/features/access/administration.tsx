"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccessError, logout } from "./access-client";
import { AdminSessionPanel } from "./admin-session-panel";
import { useSessionGate } from "./session-gate";

export function Administration() {
  const router = useRouter();
  const gate = useSessionGate({ adminOnly: true });
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

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

  if (gate.status === "unavailable") {
    return (
      <div>
        <p className="text-base leading-relaxed text-[#8b3028]" role="alert">
          Não foi possível verificar seu acesso. Tente novamente em instantes.
        </p>
        <button
          className="mt-6 min-h-12 rounded-xl border border-[#6b8576] px-5 py-3 font-semibold transition-colors hover:bg-[#e7efea] motion-reduce:transition-none"
          type="button"
          onClick={gate.retry}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (gate.status === "checking") {
    return <p className="text-base leading-relaxed text-[#3c5b4b]" role="status">Verificando seu acesso...</p>;
  }

  return (
    <AdminSessionPanel
      email={gate.session.email}
      onLogout={handleLogout}
      pending={pending}
      errorMessage={errorMessage}
    />
  );
}
