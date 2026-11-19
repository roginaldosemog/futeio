"use client";

import { useEffect, useRef, useState } from "react";
import { AccessError, apiMutation, apiRequest } from "@/lib/api-client";
import { AdminLogin } from "./admin-login";
import type { GoogleAuthConfig } from "./google-auth";
import type { components } from "@futeio/contracts";

type State = "loading" | "login" | "ready" | "sending" | "complete" | "failed";
const action = "mt-6 flex min-h-13 w-full items-center justify-center rounded-xl bg-[#163b2a] px-5 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-[#22533d] disabled:cursor-wait disabled:bg-[#d6e2db] disabled:text-[#3c5b4b] motion-reduce:transition-none";

function checkedRedirect(value: unknown, state: string): string {
  if (typeof value !== "string") throw new AccessError(503);
  const url = new URL(value);
  if (url.protocol !== "futeio:" || url.hostname !== "auth" || url.pathname !== "/callback" || url.username || url.password || url.port || url.hash ||
      url.searchParams.get("state") !== state || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("code") ?? "") || [...url.searchParams.keys()].sort().join(",") !== "code,state") throw new AccessError(503);
  return url.toString();
}

async function verification(): Promise<{ status: State; error?: string }> {
  try {
    const response = await apiRequest("auth/me");
    const session = await response.json() as components["schemas"]["SessionResponseDto"];
    return { status: session.role === "ADMIN" ? "ready" : "login" };
  } catch (failure) {
    if (failure instanceof AccessError && failure.status === 401) return { status: "login" };
    return { status: "failed", error: "Não foi possível verificar seu acesso. Confira a conexão e tente novamente." };
  }
}

export function NativeAuthorization({ codeChallenge, state, googleConfig }: { codeChallenge: string; state: string; googleConfig: GoogleAuthConfig }) {
  const [status, setStatus] = useState<State>("loading");
  const [error, setError] = useState<string>();
  const [redirect, setRedirect] = useState<string>();
  const mounted = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void verification().then(result => {
      if (!cancelled) { setStatus(result.status); setError(result.error); }
    });
    return () => { cancelled = true; mounted.current = false; };
  }, []);

  function retryVerification() {
    setStatus("loading"); setError(undefined);
    void verification().then(result => {
      if (mounted.current) { setStatus(result.status); setError(result.error); }
    });
  }

  async function authorize() {
    if (lock.current) return;
    lock.current = true; setStatus("sending"); setError(undefined);
    try {
      const response = await apiMutation("auth/native/admin/authorize", { codeChallenge, state });
      const result = await response.json() as components["schemas"]["NativeAuthorizeResponseDto"];
      const target = checkedRedirect(result.redirectUrl, state);
      if (mounted.current) { setRedirect(target); setStatus("complete"); }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof AccessError && [401, 403].includes(failure.status)) { setStatus("login"); setError("Entre novamente para confirmar o acesso ao aplicativo."); }
      else { setStatus("ready"); setError(failure instanceof AccessError && failure.status === 429 ? "Muitas solicitações. Aguarde alguns minutos e tente novamente." : "Não foi possível autorizar. Tente novamente."); }
    } finally { lock.current = false; }
  }

  return <div className="text-base leading-relaxed text-[#3c5b4b]">
    {error ? <p role="alert" className="mb-5 text-[#8a2632]">{error}</p> : null}
    {status === "loading" ? <p role="status">Verificando seu acesso...</p> : null}
    {status === "login" ? <><p className="mb-6">Entre com sua conta de administrador. Depois você poderá autorizar o aplicativo.</p><AdminLogin googleConfig={googleConfig} onAuthenticated={retryVerification} /></> : null}
    {status === "ready" || status === "sending" ? <>
      <p>O aplicativo Fute.io terá acesso de administrador para gerenciar jogadores, avaliações e sorteios.</p>
      <p className="mt-4 font-semibold text-[#163b2a]">Só autorize se você iniciou esta entrada no seu próprio celular.</p>
      <button type="button" className={action} disabled={status === "sending"} onClick={() => { void authorize(); }}>{status === "sending" ? "Autorizando..." : "Autorizar aplicativo"}</button>
    </> : null}
    {status === "complete" && redirect ? <><p>Acesso autorizado. Volte ao aplicativo para concluir a entrada.</p><a className={action} href={redirect} rel="noreferrer">Voltar ao aplicativo</a></> : null}
    {status === "failed" ? <button type="button" className={action} onClick={retryVerification}>Verificar novamente</button> : null}
  </div>;
}
