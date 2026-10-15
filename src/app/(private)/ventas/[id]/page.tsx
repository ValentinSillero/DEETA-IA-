import { ArrowLeft, CheckCircle2, CircleCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelSaleForm } from "@/components/sales/cancel-sale-form";
import { getSaleForUser } from "@/data/sales";
import { formatMoney } from "@/lib/inventory";
import { PAYMENT_METHOD_LABELS, saleDisplayNumber } from "@/lib/sales";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Detalle de venta" };

export default async function SaleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creada?: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const [sale, query] = await Promise.all([getSaleForUser(session.user.id, id), searchParams]);
  if (!sale) notFound();
  const completed = sale.status === "COMPLETED";
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/ventas" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a ventas</Link>
      {query.creada === "1" && <p className="notice-success mt-4 flex items-center gap-2" role="status"><CheckCircle2 className="size-5 shrink-0" aria-hidden="true" /> Venta guardada correctamente.</p>}

      {/* Comprobante interno: lectura de ticket, no de tarjeta. */}
      <article className="mt-5 rounded-2xl border border-line bg-surface">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-line-strong px-5 py-5 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-muted">Comprobante interno</p>
            <h1 className="page-title mt-0.5">Venta #{saleDisplayNumber(sale.id)}</h1>
            <p className="mt-1 text-sm text-muted">{new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Montevideo" }).format(sale.createdAt)}</p>
          </div>
          <span className={`status text-sm ${completed ? "text-success" : "text-red-700"}`}>
            {completed ? <CircleCheck className="size-4" aria-hidden="true" /> : <CircleX className="size-4" aria-hidden="true" />}
            {completed ? "Completada" : "Cancelada"}
          </span>
        </header>
        <div className="px-5 py-4 sm:px-6">
          <h2 className="sr-only">Productos</h2>
          <ul className="divide-y divide-line">
            {sale.items.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 py-3">
                <div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="text-sm text-muted">{item.quantity} × {formatMoney(item.unitPriceCents)}</p></div>
                <p className="shrink-0 font-semibold tabular-nums">{formatMoney(item.subtotalCents)}</p>
              </li>
            ))}
          </ul>
          <div className="ledger-total mt-2">
            <p className="font-semibold">Total</p>
            <p className={`figure text-[2rem] leading-none ${completed ? "" : "text-muted line-through"}`}>{formatMoney(sale.totalCents)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-line text-sm">
          <div className="border-r border-line px-5 py-3.5 sm:px-6"><dt className="text-muted">Pago</dt><dd className="mt-0.5 font-semibold">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</dd></div>
          <div className="px-5 py-3.5 sm:px-6"><dt className="text-muted">Realizada por</dt><dd className="mt-0.5 truncate font-semibold">{sale.createdByName}</dd></div>
        </dl>
      </article>

      {sale.status === "CANCELLED" ? (
        <div className="notice-error mt-5">
          <p className="font-semibold">Venta cancelada</p>
          <p className="mt-1">{sale.cancelledAt ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Montevideo" }).format(sale.cancelledAt) : ""}{sale.cancelledByName ? ` por ${sale.cancelledByName}` : ""}</p>
          {sale.cancellationReason && <p className="mt-1">Motivo: {sale.cancellationReason}</p>}
        </div>
      ) : <CancelSaleForm saleId={sale.id} />}
    </div>
  );
}
