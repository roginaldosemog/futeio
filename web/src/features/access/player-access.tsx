"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiMutation, AccessError } from "@/lib/api-client";
import type { SessionResponse } from "./access-client";
import { buttonClass } from "./private-workspace";

export function PlayerAccess() {
  const router = useRouter();
  const token = useRef<string | null>(null);
  const submitting = useRef(false);
  const captured = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    mounted.current = true;
    function captureFragment() {
      const fragment = window.location.hash;
      // Strict Mode replays this effect after the initial fragment was removed.
      // A queued hashchange may also refer to an already captured fragment.
      if (captured.current && !fragment) return;
      captured.current = true;
      revision.current += 1;
      token.current = new URLSearchParams(fragment.slice(1)).get("token");
      // Remove each bearer credential before making requests or navigating elsewhere.
      window.history.replaceState(null, "", window.location.pathname);
      setValid(Boolean(token.current && /^[A-Za-z0-9_-]{43}$/.test(token.current)));
      setError(undefined);
      setCompleted(false);
      setReady(true);
    }
    window.addEventListener("hashchange", captureFragment);
    captureFragment();
    return () => {
      mounted.current = false;
      window.removeEventListener("hashchange", captureFragment);
    };
  }, []);
  async function enter() {
    if (submitting.current || completed || !valid || !token.current) return;
    const attemptRevision = revision.current;
    const attemptToken = token.current;
    submitting.current = true;
    setPending(true);
    setError(undefined);
    try {
      const response = await apiMutation("auth/player/redeem", { token: attemptToken });
      const session: SessionResponse = await response.json();
      if (!mounted.current || attemptRevision !== revision.current) return;
      token.current = null;
      setCompleted(true);
      router.replace(session.playerId ? `/jogadores/${session.playerId}` : "/jogadores");
    } catch (failure) {
      if (!mounted.current || attemptRevision !== revision.current) return;
      if (failure instanceof AccessError && (failure.status === 400 || failure.status === 401)) {
        token.current = null;
        setValid(false);
      } else
        setError(
          failure instanceof AccessError && failure.status === 429
            ? "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."
            : "Não foi possível entrar. Tente novamente em instantes.",
        );
    } finally {
      // Never overlap redemption POSTs: even a stale response may rotate cookies.
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }
  if (!ready) return <p role="status">Preparando seu acesso...</p>;
  if (!valid)
    return (
      <div>
        <h2 className="text-xl font-bold">Link indisponível</h2>
        <p className="mt-4 leading-relaxed text-[#3c5b4b]">
          Este link está incompleto, inválido ou foi substituído. Peça um novo link ao administrador
          da sua pelada.
        </p>
      </div>
    );
  return (
    <div aria-busy={pending}>
      <p className="leading-relaxed text-[#3c5b4b]">
        Seu link pessoal permite acessar o grupo, editar seu perfil e avaliar a turma. Guarde o link
        e não o compartilhe com outras pessoas.
      </p>
      <button
        type="button"
        className={`${buttonClass} mt-7`}
        onClick={enter}
        disabled={pending || completed}
      >
        {pending || completed ? "Entrando..." : "Entrar na pelada"}
      </button>
      {error ? (
        <p role="alert" className="mt-5 text-[#8b3028]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
