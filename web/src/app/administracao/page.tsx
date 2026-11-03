import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { Administration } from "@/features/access/administration";

export const metadata: Metadata = {
  title: "Administração | Futeio",
  robots: { index: false, follow: false },
};

export default function AdministrationPage() {
  return (
    <AccessFrame title="Administração da pelada">
      <Administration />
    </AccessFrame>
  );
}
