import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { AdminLogin } from "@/features/access/admin-login";

export const metadata: Metadata = {
  title: "Entrar | Futeio",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AccessFrame title="Entrar no Futeio" description="Entre com seu e-mail e senha para administrar a pelada.">
      <AdminLogin />
    </AccessFrame>
  );
}
