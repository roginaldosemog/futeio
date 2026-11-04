"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { AccessError, currentSession, logout, type SessionResponse } from "./access-client";

export const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#163b2a] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#22533d] disabled:cursor-not-allowed disabled:bg-[#d6e2db] disabled:text-[#3c5b4b] motion-reduce:transition-none";
export const secondaryClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-[#6b8576] px-5 py-3 font-semibold transition-colors hover:bg-[#e7efea] disabled:cursor-not-allowed disabled:text-[#6b8576] motion-reduce:transition-none";
export const inputClass =
  "mt-2 block min-h-12 w-full rounded-xl border border-[#6b8576] bg-white px-4 py-3 text-base text-[#163b2a] placeholder:text-[#526e5e]";

export function denied(error: unknown) {
  return error instanceof AccessError && error.status === 401;
}

export function usePrivateError(...errors: unknown[]) {
  const client = useQueryClient();
  const router = useRouter();
  const expired = errors.some(denied);
  useEffect(() => {
    if (expired) {
      client.clear();
      router.replace("/entrar");
    }
  }, [expired, client, router]);
  return expired;
}

export function WorkspaceNavigation({ session }: { session: SessionResponse }) {
  const router = useRouter();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function exit() {
    setPending(true);
    setError(false);
    try {
      await logout();
      client.clear();
      router.replace("/entrar");
    } catch (failure) {
      if (denied(failure)) {
        client.clear();
        router.replace("/entrar");
      } else {
        setError(true);
        setPending(false);
      }
    }
  }
  return (
    <div className="mb-10 border-b border-[#d6e2db] pb-5">
      <nav
        aria-label="Navegação da pelada"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold"
      >
        <Link
          href="/jogadores"
          className="inline-flex min-h-12 items-center underline underline-offset-4"
        >
          Jogadores e avaliações
        </Link>
        <Link
          href="/sorteios"
          className="inline-flex min-h-12 items-center underline underline-offset-4"
        >
          Histórico de times
        </Link>
        {session.role === "ADMIN" ? (
          <Link
            href="/administracao"
            className="inline-flex min-h-12 items-center underline underline-offset-4"
          >
            Administração
          </Link>
        ) : null}
        <button
          type="button"
          className="min-h-12 px-1 underline underline-offset-4 disabled:cursor-wait"
          disabled={pending}
          onClick={exit}
        >
          {pending ? "Saindo..." : "Sair"}
        </button>
      </nav>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[#8b3028]">
          Não foi possível sair. Tente novamente.
        </p>
      ) : null}
    </div>
  );
}

function WorkspaceSession({
  adminOnly,
  children,
}: {
  adminOnly: boolean;
  children: (session: SessionResponse) => ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    currentSession(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        if (adminOnly && value.role !== "ADMIN") {
          router.replace("/jogadores");
          return;
        }
        setSession(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          if (denied(error)) router.replace("/entrar");
          else setFailed(true);
        }
      });
    return () => controller.abort();
  }, [adminOnly, attempt, router]);
  if (failed)
    return (
      <div>
        <p role="alert" className="text-[#8b3028]">
          Não foi possível verificar seu acesso.
        </p>
        <button
          className={`${secondaryClass} mt-5`}
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  if (!session) return <p role="status">Verificando seu acesso...</p>;
  return (
    <>
      <WorkspaceNavigation session={session} />
      {children(session)}
    </>
  );
}

export function PrivateWorkspace({
  children,
  adminOnly = false,
}: {
  children: (session: SessionResponse) => ReactNode;
  adminOnly?: boolean;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
          mutations: { retry: false, gcTime: 0 },
        },
      }),
  );
  useEffect(() => () => client.clear(), [client]);
  return (
    <QueryClientProvider client={client}>
      <WorkspaceSession adminOnly={adminOnly}>{children}</WorkspaceSession>
    </QueryClientProvider>
  );
}
