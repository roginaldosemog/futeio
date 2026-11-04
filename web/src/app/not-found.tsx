import Link from "next/link";
import { AccessFrame } from "@/features/access/access-frame";

export default function NotFound() {
  return (
    <AccessFrame
      title="Página não encontrada"
      description="O endereço pode ter mudado ou estar incompleto."
    >
      <Link
        href="/"
        className="inline-flex min-h-12 items-center rounded-xl bg-[#163b2a] px-5 py-3 font-semibold text-white hover:bg-[#22533d]"
      >
        Voltar ao início
      </Link>
    </AccessFrame>
  );
}
