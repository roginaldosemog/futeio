"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type SessionResponse } from "../access/access-client";
import { PrivateWorkspace, secondaryClass, usePrivateError } from "../access/private-workspace";
import { formatRating, formatDate } from "@/lib/format";
import { getDraw, type Draw } from "./draws-client";

export function drawText(draw: Draw) {
  return [
    `Futeio — ${formatDate(draw.createdAt)}`,
    ...draw.teams.map(
      (team) =>
        `\nTime ${team.number}\n${team.players.map((player) => player.name).join("\n")}\nSoma: ${formatRating(team.total)} · Média: ${formatRating(team.average)}`,
    ),
  ].join("\n");
}
function ResultContent({ id, session }: { id: string; session: SessionResponse }) {
  const query = useQuery({
    queryKey: ["draw", session.groupId, session.identityId, id],
    queryFn: ({ signal }) => getDraw(id, signal),
  });
  const [notice, setNotice] = useState<string>();
  const expired = usePrivateError(query.error);
  if (expired) return <p role="status">Verificando seu acesso...</p>;
  if (query.isPending) return <p role="status">Carregando os times...</p>;
  if (query.isError)
    return (
      <div>
        <p role="alert" className="text-[#8b3028]">
          Não foi possível abrir este sorteio. Ele pode não estar disponível no seu grupo.
        </p>
        <button className={`${secondaryClass} mt-5`} onClick={() => void query.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  const draw = query.data;
  async function copy() {
    try {
      await navigator.clipboard.writeText(drawText(draw));
      setNotice("Times copiados. Você pode compartilhar com a turma.");
    } catch {
      setNotice("Não foi possível copiar. Selecione os nomes e copie manualmente.");
    }
  }
  return (
    <div>
      <p className="text-[#3c5b4b]">Sorteio de {formatDate(draw.createdAt)}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button className={secondaryClass} onClick={copy}>
          Copiar times
        </button>
        <Link
          href="/sorteios"
          className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
        >
          Ver histórico
        </Link>
      </div>
      {notice ? (
        <p role="status" className="mt-4">
          {notice}
        </p>
      ) : null}
      <div className="mt-9 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2">
        {draw.teams.map((team) => (
          <section key={team.number} className="min-w-0" aria-label={`Time ${team.number}`}>
            <h2 className="border-b border-[#6b8576] pb-4 text-2xl font-bold">
              Time {team.number}
            </h2>
            <ol className="divide-y divide-[#d6e2db]">
              {team.players.map((player) => (
                <li
                  key={player.id}
                  className="flex min-h-16 items-center justify-between gap-4 py-4"
                >
                  <Link
                    href={`/jogadores/${player.id}`}
                    className="min-w-0 font-semibold underline underline-offset-4 [overflow-wrap:anywhere]"
                  >
                    {player.name}
                  </Link>
                  <span className="shrink-0 text-sm text-[#3c5b4b] tabular-nums">
                    {formatRating(player.rating)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-[#3c5b4b]">
              Soma{" "}
              <strong className="mr-4 text-[#163b2a] tabular-nums">
                {formatRating(team.total)}
              </strong>{" "}
              Média{" "}
              <strong className="text-[#163b2a] tabular-nums">{formatRating(team.average)}</strong>
            </p>
          </section>
        ))}
      </div>
      <section className="mt-12 border-t border-[#d6e2db] pt-8" aria-labelledby="balance-heading">
        <h2 id="balance-heading" className="text-2xl font-bold">
          Como estes times foram montados
        </h2>
        <p className="mt-4 max-w-[65ch] leading-relaxed text-[#3c5b4b]">
          O sorteio busca diminuir a diferença entre as somas das notas dos times. Neste resultado,
          a diferença entre a maior e a menor soma é{" "}
          <strong className="tabular-nums">{formatRating(draw.spread)}</strong>. O equilíbrio das
          notas ajuda na organização; o resultado em campo depende de quem joga.
        </p>
        <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-[#3c5b4b]">
          As notas acima são as que valiam no momento do sorteio. Novas avaliações não alteram este
          registro. As notas são exibidas com duas casas decimais; os totais usam a precisão
          completa.
        </p>
        <details className="mt-5">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold underline underline-offset-4">
            Detalhes de reprodução
          </summary>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="font-semibold">Algoritmo</dt>
              <dd className="mt-1 break-all">{draw.algorithmVersion}</dd>
            </div>
            <div>
              <dt className="font-semibold">Cálculo das notas</dt>
              <dd className="mt-1 break-all">{draw.calculationVersion}</dd>
            </div>
            <div>
              <dt className="font-semibold">Semente</dt>
              <dd className="mt-1 break-all">{draw.seed}</dd>
            </div>
          </dl>
        </details>
      </section>
    </div>
  );
}
export function DrawResult({ id }: { id: string }) {
  return (
    <PrivateWorkspace>
      {(session) => <ResultContent key={id} id={id} session={session} />}
    </PrivateWorkspace>
  );
}
