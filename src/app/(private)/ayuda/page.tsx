import type { Metadata } from "next";

import { SupportOptions } from "@/components/support/support-options";
import { requireSession } from "@/lib/session";
import { getSupportWhatsappNumber, supportSectionLabel } from "@/lib/support";

export const metadata: Metadata = { title: "Ayuda y sugerencias" };

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ desde?: string | string[] }> }) {
  const [, params] = await Promise.all([requireSession(), searchParams]);
  // Solo se acepta una sección conocida; cualquier otro valor se ignora.
  const section = supportSectionLabel(typeof params.desde === "string" ? params.desde : null);
  const number = getSupportWhatsappNumber();

  return (
    <div className="max-w-2xl">
      <h1 className="page-title">Ayuda y sugerencias</h1>
      <p className="mt-3 max-w-xl leading-7 text-muted">¿Algo no te quedó claro o encontraste un problema? Contame por WhatsApp y te respondo.</p>
      <div className="mt-7">
        <SupportOptions number={number} section={section} />
      </div>
      <p className="mt-6 max-w-xl text-sm leading-6 text-muted">DEETA está en etapa beta. Estamos mejorándolo con comercios reales y tu comentario nos ayuda a decidir qué sigue.</p>
    </div>
  );
}
