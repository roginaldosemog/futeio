import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { AdminLogin } from "@/features/access/admin-login";
import { publicGoogleConfig } from "@/server/public-auth-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar | Futeio",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  // Firebase web identifiers are public. Never pass admin identity or server secrets.
  const googleConfig = publicGoogleConfig();
  return (
    <AccessFrame
      title="Entrar no Futeio"
      description="Entre com sua conta Google ou e-mail e senha para administrar a pelada."
    >
      <AdminLogin googleConfig={googleConfig} />
      <p className="mt-8 border-t border-[#d6e2db] pt-6 text-sm leading-relaxed text-[#3c5b4b]">
        Para entrar como jogador, reabra seu link pessoal. Se ele não funcionar, peça outro ao
        administrador da pelada.
      </p>
    </AccessFrame>
  );
}
