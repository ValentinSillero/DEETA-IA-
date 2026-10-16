import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CashStatement } from "@/components/cash/cash-statement";
import { getCashSessionForUser } from "@/data/cash";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export default async function CashDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params; const cash = await getCashSessionForUser(session.user.id, id); if (!cash) notFound();
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "CASH_VIEW_HISTORY")) return <NoAccess section="el historial de caja" />;
  const date = (value: Date) => new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: cash.timezone }).format(value);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/caja" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a caja</Link>
      <div className="mt-3">
        <h1 className="page-title">Caja {cash.status === "OPEN" ? "abierta" : "cerrada"}</h1>
        <p className="page-lead">Abierta el {date(cash.openedAt)} por {cash.openedByName}</p>
      </div>
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label="Hoja de caja">
        <CashStatement cash={cash} size="large" />
      </section>
      {cash.closedAt && <p className="mt-4 text-sm text-muted">Cerrada el {date(cash.closedAt)}{cash.closedByName ? ` por ${cash.closedByName}` : ""}.</p>}
    </div>
  );
}
