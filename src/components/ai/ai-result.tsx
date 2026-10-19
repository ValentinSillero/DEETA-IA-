import type { LucideIcon } from "lucide-react";

// Marco común de las respuestas con datos: título corto, contenido y, al pie,
// el período en letra chica para que no compita con el dato principal.
export function AiResult({ title, icon: Icon, meta, children }: { title: string; icon?: LucideIcon; meta?: React.ReactNode; children: React.ReactNode }) {
  return <section className="mt-1 min-w-0 rounded-xl border border-line bg-surface px-4 pb-3 pt-3.5" aria-label={title}>
    <h3 className="flex min-w-0 items-center gap-2 font-sans text-sm font-semibold tracking-normal text-muted">
      {Icon ? <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" /> : null}
      <span className="min-w-0 break-words">{title}</span>
    </h3>
    <div className="mt-2 min-w-0">{children}</div>
    {meta ? <p className="mt-3 text-xs leading-5 text-subtle">{meta}</p> : null}
  </section>;
}

// Fila concepto … valor, el mismo lenguaje de comprobante que usa Caja.
export function AiLedgerRow({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return <div className="py-1.5">
    <div className="ledger-row py-0"><span>{label}</span><span className="ledger-fill" aria-hidden="true" /><span>{value}</span></div>
    {note ? <p className="mt-0.5 text-xs leading-5 text-muted">{note}</p> : null}
  </div>;
}
