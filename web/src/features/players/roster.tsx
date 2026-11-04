"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatRating } from "@/lib/format";
import { type SessionResponse } from "../access/access-client";
import {
  inputClass,
  PrivateWorkspace,
  secondaryClass,
  usePrivateError,
} from "../access/private-workspace";
import { listPlayers } from "./players-client";

function RosterContent({ session }: { session: SessionResponse }) {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["roster", session.groupId, session.identityId],
    queryFn: ({ signal }) => listPlayers(signal),
  });
  const expired = usePrivateError(query.error);
  if (expired) return <p role="status">Verificando seu acesso...</p>;
  if (query.isPending) return <p role="status">Carregando jogadores...</p>;
  if (query.isError)
    return (
      <div>
        <p role="alert" className="text-[#8b3028]">
          Não foi possível carregar a turma.
        </p>
        <button className={`${secondaryClass} mt-5`} onClick={() => void query.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  const players = query.data;
  const visible = players.filter((player) =>
    player.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <label className="block w-full max-w-md font-semibold">
          Buscar jogador
          <input
            className={inputClass}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome de quem joga com a turma"
          />
        </label>
        <p className="pb-3 text-sm text-[#3c5b4b]">
          {players.length} {players.length === 1 ? "jogador cadastrado" : "jogadores cadastrados"}
        </p>
      </div>
      <p className="mt-7 max-w-[65ch] leading-relaxed text-[#3c5b4b]">
        Abra um perfil para avaliar, atualizar sua nota ou consultar as avaliações. Você também pode
        se autoavaliar.
      </p>
      {!players.length ? (
        <p className="mt-8">O administrador ainda não cadastrou jogadores.</p>
      ) : !visible.length ? (
        <p role="status" className="mt-8">
          Nenhum jogador encontrado com esse nome.
        </p>
      ) : (
        <ul
          aria-label="Jogadores da pelada"
          className="mt-8 divide-y divide-[#d6e2db] border-y border-[#d6e2db]"
        >
          {visible.map((player) => (
            <li key={player.id}>
              <Link
                href={`/jogadores/${player.id}`}
                className="flex min-h-24 flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg py-5 hover:bg-[#edf3ef]"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-semibold break-words underline underline-offset-4 [overflow-wrap:anywhere]">
                    {player.name}
                  </p>
                  <p className="mt-2 text-sm text-[#3c5b4b]">
                    {player.isOwnProfile ? "Seu perfil · " : ""}
                    {player.myRating == null
                      ? "Avaliação pendente"
                      : `Sua avaliação: ${player.myRating}`}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-xl font-bold tabular-nums">
                    {formatRating(player.rating)}
                  </span>
                  <span className="text-xs text-[#3c5b4b]">Nota consolidada</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Roster() {
  return <PrivateWorkspace>{(session) => <RosterContent session={session} />}</PrivateWorkspace>;
}
