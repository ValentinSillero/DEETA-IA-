import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
  return <div className="mx-auto max-w-3xl"><Link href="/ventas" className="inline-flex items-center gap-2 text-sm font-bold text-muted"><ArrowLeft className="size-4" /> Volver a ventas</Link>{query.creada === "1" && <p className="notice-success mt-5 flex items-center gap-2"><CheckCircle2 className="size-5" /> Venta guardada correctamente.</p>}<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-extrabold uppercase tracking-[0.12em] text-mint-600">Comprobante interno</p><h1 className="mt-2 text-3xl font-black">Venta #{saleDisplayNumber(sale.id)}</h1><p className="mt-2 text-muted">{new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Montevideo" }).format(sale.createdAt)}</p></div><span className={`self-start rounded-full px-3 py-2 text-sm font-extrabold ${sale.status === "COMPLETED" ? "bg-accent-soft text-success" : "bg-red-50 text-red-700"}`}>{sale.status === "COMPLETED" ? "Completada" : "Cancelada"}</span></div>
  <section className="panel mt-6"><h2 className="text-xl font-black">Productos</h2><div className="mt-4 divide-y divide-line">{sale.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-4"><div><p className="font-extrabold">{item.name}</p><p className="mt-1 text-sm text-muted">{item.quantity} × {formatMoney(item.unitPriceCents)}</p></div><p className="font-black">{formatMoney(item.subtotalCents)}</p></div>)}</div><div className="mt-3 flex items-end justify-between border-t-2 border-ink pt-5"><p className="font-black">TOTAL</p><p className="text-3xl font-black">{formatMoney(sale.totalCents)}</p></div></section>
  <section className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold text-muted">Pago</p><p className="mt-1 font-black">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</p></div><div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold text-muted">Realizada por</p><p className="mt-1 font-black">{sale.createdByName}</p></div></section>
  {sale.status === "CANCELLED" ? <div className="notice-error mt-6"><p className="font-black">Venta cancelada</p><p className="mt-1">{sale.cancelledAt ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Montevideo" }).format(sale.cancelledAt) : ""}{sale.cancelledByName ? ` por ${sale.cancelledByName}` : ""}</p>{sale.cancellationReason && <p className="mt-1">Motivo: {sale.cancellationReason}</p>}</div> : <CancelSaleForm saleId={sale.id} />}</div>;
}
