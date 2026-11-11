"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AccessError } from "../access/access-client";
import type { SessionResponse } from "../access/access-client";
import { createPlayer, listPlayers } from "./players-client";
import type { CreatePlayerInput, CreatePlayerResult, PlayerSummary } from "./players-client";
import { CreatePlayerForm } from "./create-player-form";
import { CreatedPlayerResult } from "./created-player-result";
import { PlayerList } from "./player-list";
import { useSessionGate } from "../access/session-gate";
import { writeFailure } from "@/lib/write-outcome";

function denied(error: unknown) { return error instanceof AccessError && (error.status === 401 || error.status === 403); }
function creationError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof AccessError) {
    if (error.status === 400) return "Confira o nome e a nota inicial, de 0 a 10.";
    if (error.status === 409) return "Seu perfil já está cadastrado. Confira a lista de jogadores.";
    if (error.status === 429) return "Muitas tentativas. Aguarde alguns minutos e atualize a lista antes de tentar novamente.";
  }
  return "Não foi possível confirmar o cadastro. Atualize a lista antes de tentar novamente.";
}

function PlayersWorkspace({ session }: { session: SessionResponse }) {
  const router = useRouter();
  const client = useQueryClient();
  const [receipt, setReceipt] = useState<CreatePlayerResult | null>(null);
  const [mustReview, setMustReview] = useState(false);
  const [focusForm, setFocusForm] = useState(false);
  const queryKey = ["players", session.groupId, session.identityId];
  const roster = useQuery({ queryKey, queryFn: ({ signal }) => listPlayers(signal) });
  const creation = useMutation({
    mutationFn: createPlayer,
    retry: false,
    gcTime: 0,
    onSuccess: (result) => {
      setReceipt(result);
      client.setQueryData<PlayerSummary[]>(queryKey, (previous = []) => [...previous.filter((player) => player.id !== result.player.id), result.player]);
      // A failed list refresh must not turn a confirmed POST into a failed creation.
      void client.invalidateQueries({ queryKey });
    },
    // An uncertain creation stays blocked until the roster is reconciled.
    onError: (error) => { setMustReview(writeFailure(error) === "uncertain"); },
  });
  const accessDenied = denied(roster.error) || denied(creation.error);

  useEffect(() => {
    if (accessDenied) { client.clear(); router.replace("/entrar"); }
  }, [accessDenied, client, router]);

  async function save(input: CreatePlayerInput): Promise<boolean> {
    setReceipt(null);
    creation.reset();
    try { await creation.mutateAsync(input); return true; }
    catch { return false; }
  }
  async function refreshRoster() {
    const result = await roster.refetch();
    if (result.isSuccess) setMustReview(false);
  }
  function nextPlayer() { creation.reset(); setReceipt(null); setMustReview(false); setFocusForm(true); }

  if (accessDenied) return <p role="status" className="text-base leading-relaxed text-[#3c5b4b]">Verificando seu acesso...</p>;
  const players = roster.data ?? [];
  return (
    <div>
      <Link href="/administracao" className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4">Voltar à administração</Link>
      <div className="mt-8 grid gap-12 md:grid-cols-2 md:gap-14">
        <section aria-label="Cadastro de jogador" className="min-w-0">
          {receipt ? <CreatedPlayerResult result={receipt} onNext={nextPlayer} /> : (
            <>
              <h2 className="mb-6 text-2xl leading-tight font-bold">Cadastrar jogador</h2>
              <CreatePlayerForm onSubmit={save} pending={creation.isPending} ownProfileExists={players.some((player) => player.isOwnProfile)} blocked={mustReview || roster.isPending || !roster.data} focusName={focusForm} errorMessage={creationError(creation.error)} />
            </>
          )}
        </section>
        <section aria-labelledby="roster-heading" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 id="roster-heading" className="text-2xl leading-tight font-bold">Jogadores cadastrados</h2>
            <button type="button" className="min-h-12 rounded-xl px-1 py-3 text-sm font-semibold underline underline-offset-4 disabled:cursor-wait disabled:text-[#3c5b4b]" disabled={roster.isFetching || creation.isPending} onClick={refreshRoster}>{roster.isFetching ? "Atualizando..." : "Atualizar lista"}</button>
          </div>
          {roster.isPending ? <p role="status" className="text-base leading-relaxed text-[#3c5b4b]">Carregando jogadores...</p> : null}
          {roster.isError ? <p role="alert" className="mb-5 text-base leading-relaxed text-[#8b3028]">Não foi possível carregar os jogadores. Tente atualizar a lista.</p> : null}
          {roster.data ? <PlayerList players={players} /> : null}
        </section>
      </div>
    </div>
  );
}

function PrivatePlayersWorkspace({ session }: { session: SessionResponse }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false }, mutations: { retry: false, gcTime: 0 } } }));
  useEffect(() => () => { client.clear(); }, [client]);
  return <QueryClientProvider client={client}><PlayersWorkspace session={session} /></QueryClientProvider>;
}

export function PlayersAdministration() {
  const gate = useSessionGate({ adminOnly: true });
  if (gate.status === "unavailable") return <div><p role="alert" className="text-base leading-relaxed text-[#8b3028]">Não foi possível verificar seu acesso. Tente novamente em instantes.</p><button type="button" className="mt-6 min-h-12 rounded-xl border border-[#6b8576] px-5 py-3 font-semibold" onClick={gate.retry}>Tentar novamente</button></div>;
  if (gate.status === "checking") return <p role="status" className="text-base leading-relaxed text-[#3c5b4b]">Verificando seu acesso...</p>;
  return <PrivatePlayersWorkspace session={gate.session} />;
}
