import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { NativeAuthorization } from "@/features/access/native-authorization";
import { publicGoogleConfig } from "@/server/public-auth-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acessar aplicativo | Fute.io", robots: { index: false, follow: false } };

export default async function NativeAccessPage({ searchParams }: { searchParams: Promise<{ codeChallenge?: string | string[]; state?: string | string[] }> }) {
  const { codeChallenge, state } = await searchParams;
  const valid = typeof codeChallenge === "string" && typeof state === "string" && /^[A-Za-z0-9_-]{43}$/.test(codeChallenge) && /^[A-Za-z0-9_-]{43}$/.test(state);
  return <AccessFrame title="Entrar no aplicativo" description="Confirme o acesso ao Fute.io no seu celular.">
    {valid ? <NativeAuthorization key={`${codeChallenge}:${state}`} codeChallenge={codeChallenge} state={state} googleConfig={publicGoogleConfig()} />
      : <p className="text-base leading-relaxed text-[#3c5b4b]">Abra esta página pelo botão Entrar com Google no aplicativo Fute.io.</p>}
  </AccessFrame>;
}
