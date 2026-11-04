"use client";

import Link from "next/link";
import { AccessFrame } from "@/features/access/access-frame";
import { buttonClass } from "@/features/access/private-workspace";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <AccessFrame
      title="Não foi possível abrir esta página"
      description="Tente novamente. Se o problema continuar, volte ao início."
    >
      <div className="flex flex-wrap items-center gap-5">
        <button className={buttonClass} onClick={reset}>
          Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
        >
          Voltar ao início
        </Link>
      </div>
    </AccessFrame>
  );
}
