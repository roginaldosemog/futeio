"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AccessError } from "@/lib/api-client";
import { type SessionResponse } from "../access/access-client";
import {
  buttonClass,
  inputClass,
  PrivateWorkspace,
  secondaryClass,
  usePrivateError,
} from "../access/private-workspace";
import { listPlayers } from "../players/players-client";
import { formatRating } from "@/lib/format";
import { createDraw } from "./draws-client";

function DrawCreationContent({ session }: { session: SessionResponse }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const roster = useQuery({
    queryKey: ["roster", session.groupId, session.identityId],
    queryFn: ({ signal }) => listPlayers(signal),
  });
  const creation = useMutation({
    mutationFn: createDraw,
    onSuccess: (draw) => router.push(`/sorteios/${draw.id}`),
    onError: (error) =>
      setUncertain(!(error instanceof AccessError) || error.status >= 500 || error.status === 429),
  });
  const expired = usePrivateError(roster.error, creation.error);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.size !== 20 || lock.current || creation.isPending || uncertain) return;
    lock.current = true;
    try {
      await creation.mutateAsync([...selected]);
    } catch {
      /* Present a safe error without retrying the draw. */
    } finally {
      lock.current = false;
    }
  }
  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < 20) next.add(id);
      return next;
    });
  }
  if (expired) return <p role="status">Verificando seu acesso...</p>;
  if (roster.isPending) return <p role="status">Carregando jogadores...</p>;
  if (roster.isError)
    return (
      <div>
        <p role="alert" className="text-[#8b3028]">
          Não foi possível carregar a turma.
        </p>
        <button className={`${secondaryClass} mt-5`} onClick={() => void roster.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  const visible = roster.data.filter((player) =>
    player.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <form onSubmit={submit} aria-busy={creation.isPending}>
      <p className="max-w-[65ch] leading-relaxed text-[#3c5b4b]">
        Selecione os 20 jogadores de linha que vão jogar. Os goleiros ficam de fora. O sorteio usa
        as notas atuais para aproximar a força de quatro times de cinco.
      </p>
      {roster.data.length < 20 ? (
        <p role="status" className="mt-5 font-semibold">
          Cadastre pelo menos 20 jogadores antes do primeiro sorteio. Há {roster.data.length} na
          lista.
        </p>
      ) : null}
      <label className="mt-7 block max-w-md font-semibold" htmlFor="draw-search">
        Buscar jogador
        <input
          id="draw-search"
          className={inputClass}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <fieldset disabled={creation.isPending} className="mt-7">
        <legend className="text-xl font-bold">Participantes do sorteio</legend>
        <p role="status" aria-live="polite" className="mt-3 font-semibold tabular-nums">
          {selected.size} de 20 selecionados
        </p>
        {!visible.length ? (
          <p className="mt-5">Nenhum jogador encontrado.</p>
        ) : (
          <div className="mt-5 grid gap-x-8 md:grid-cols-2">
            {visible.map((player) => (
              <label
                key={player.id}
                className="flex min-h-20 cursor-pointer items-center gap-4 border-b border-[#d6e2db] py-4"
              >
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-[#163b2a]"
                  checked={selected.has(player.id)}
                  disabled={selected.size === 20 && !selected.has(player.id)}
                  onChange={() => toggle(player.id)}
                />
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                  {player.name}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatRating(player.rating)}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className={buttonClass}
          disabled={selected.size !== 20 || creation.isPending || uncertain}
        >
          {creation.isPending ? "Montando os times..." : "Sortear 4 times"}
        </button>
        <button
          type="button"
          className={secondaryClass}
          disabled={!selected.size || creation.isPending}
          onClick={() => setSelected(new Set())}
        >
          Limpar seleção
        </button>
      </div>
      {creation.isError ? (
        <p role="alert" className="mt-5 max-w-[65ch] text-[#8b3028]">
          {creation.error instanceof AccessError && creation.error.status === 400
            ? "Confira a seleção: são necessários 20 jogadores distintos do grupo."
            : "Não foi possível confirmar o sorteio. Confira o histórico antes de tentar novamente; ele pode ter sido registrado."}
        </p>
      ) : null}
      {uncertain ? (
        <Link
          href="/sorteios"
          className="mt-3 inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
        >
          Conferir histórico antes de sortear novamente
        </Link>
      ) : null}
    </form>
  );
}
export function DrawCreation() {
  return (
    <PrivateWorkspace adminOnly>
      {(session) => <DrawCreationContent session={session} />}
    </PrivateWorkspace>
  );
}
