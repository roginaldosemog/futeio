"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type SessionResponse } from "../access/access-client";
import {
  buttonClass,
  PrivateWorkspace,
  secondaryClass,
  usePrivateError,
} from "../access/private-workspace";
import { listDraws } from "./draws-client";
import { formatRating, formatDate } from "@/lib/format";

function HistoryContent({ session }: { session: SessionResponse }) {
  const query = useQuery({
    queryKey: ["draws", session.groupId, session.identityId],
    queryFn: ({ signal }) => listDraws(signal),
  });
  const expired = usePrivateError(query.error);
  if (expired) return <p role="status">Verificando seu acesso...</p>;
  return (
    <div>
      {session.role === "ADMIN" ? (
        <Link href="/administracao/sorteios" className={buttonClass}>
          Montar novos times
        </Link>
      ) : null}
      {query.isSuccess && query.data.length ? (
        <p className="mt-6 text-sm text-[#3c5b4b]">Até 50 sorteios mais recentes.</p>
      ) : null}
      {query.isPending ? (
        <p role="status" className="mt-6">
          Carregando sorteios...
        </p>
      ) : query.isError ? (
        <div className="mt-6">
          <p role="alert" className="text-[#8b3028]">
            Não foi possível carregar os sorteios.
          </p>
          <button className={`${secondaryClass} mt-5`} onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : !query.data.length ? (
        <p className="mt-8 leading-relaxed text-[#3c5b4b]">
          Nenhum sorteio registrado ainda. Os times aparecerão aqui quando o administrador fizer o
          primeiro.
        </p>
      ) : (
        <ol
          aria-label="Sorteios registrados"
          className="mt-8 divide-y divide-[#d6e2db] border-y border-[#d6e2db]"
        >
          {query.data.map((draw) => (
            <li key={draw.id}>
              <Link
                href={`/sorteios/${draw.id}`}
                className="flex min-h-24 flex-wrap items-center justify-between gap-4 rounded-lg py-5 hover:bg-[#edf3ef]"
              >
                <div>
                  <p className="font-semibold underline underline-offset-4">
                    Times de {formatDate(draw.createdAt)}
                  </p>
                  <p className="mt-2 text-sm text-[#3c5b4b]">4 times · 20 jogadores</p>
                </div>
                <p className="text-sm text-[#3c5b4b]">
                  Diferença nas somas:{" "}
                  <strong className="tabular-nums">{formatRating(draw.spread)}</strong>
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
export function DrawHistory() {
  return <PrivateWorkspace>{(session) => <HistoryContent session={session} />}</PrivateWorkspace>;
}
