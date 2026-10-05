import { ArrowRight, Plus, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getSalesForUser } from "@/data/sales";
import { formatMoney } from "@/lib/inventory";
import { PAYMENT_METHOD_LABELS, saleDisplayNumber } from "@/lib/sales";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Ventas" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Montevideo" }).format(date);
}

export default async function SalesPage() {
  const session = await requireSession();
  const sales = await getSalesForUser(session.user.id);
  return <div><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-label">Historial</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Ventas</h1><p className="mt-2 text-muted">Todas las operaciones del negocio.</p></div><Link href="/vender" className="button-primary"><Plus className="size-5" aria-hidden="true" /> Nueva venta</Link></div>
  {sales.length === 0 ? <section className="panel deeta-rule mt-7 text-center"><ReceiptText className="mx-auto size-10 text-muted" aria-hidden="true" /><h2 className="mt-4 text-xl font-black">Todavía no hay ventas</h2><p className="mt-2 text-muted">Cuando cobres la primera, va a aparecer acá.</p><Link href="/vender" className="button-primary mt-6">Registrar primera venta</Link></section> : <section className="list-surface mt-7">{sales.map((sale) => <Link key={sale.id} href={`/ventas/${sale.id}`} className="group list-row"><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-black">Venta #{saleDisplayNumber(sale.id)}</p><p className="mt-1 truncate text-sm text-muted">{formatDate(sale.createdAt)}</p></div><p className="shrink-0 text-xl font-black">{formatMoney(sale.totalCents)}</p></div><div className="mt-3 flex flex-wrap gap-2 text-xs font-extrabold"><span className="rounded-lg bg-mint-50 px-2.5 py-1.5 text-mint-600">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</span><span className="rounded-lg bg-[#f3f2f8] px-2.5 py-1.5 text-muted">{sale.unitCount} {sale.unitCount === 1 ? "producto" : "productos"}</span>{sale.status === "CANCELLED" && <span className="rounded-lg bg-red-50 px-2.5 py-1.5 text-red-700">Cancelada</span>}</div></div><ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link>)}</section>}</div>;
}
