import { ArrowRight, CircleDollarSign } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CloseCashForm, OpenCashForm } from "@/components/cash/cash-forms";
import { getCashSessionsForUser } from "@/data/cash";
import { formatMoney } from "@/lib/inventory";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Caja" };

function dateLabel(date: Date, timezone: string) { return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(date); }

export default async function CashPage() {
  const session = await requireSession();
  const history = await getCashSessionsForUser(session.user.id);
  const openCash = history.find((cash) => cash.status === "OPEN") ?? null;
  return <div><div><p className="section-label text-orange-500">Efectivo</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Mi caja</h1><p className="mt-2 text-muted">Abrí, controlá y cerrá el efectivo del día.</p></div>
  <section className="mt-7 grid gap-5 lg:grid-cols-2">{openCash ? <><div className="rounded-2xl bg-ink p-6 text-white"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-accent text-ink"><CircleDollarSign className="size-6" aria-hidden="true" /></span><div><p className="text-xs font-bold text-white/60">ESTADO</p><p className="font-black text-accent">Caja abierta</p></div></div><div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15"><div className="bg-ink p-4"><p className="text-sm text-white/60">Inicial</p><p className="mt-1 break-words text-xl font-black">{formatMoney(openCash.openingAmountCents)}</p></div><div className="bg-ink p-4"><p className="text-sm text-white/60">Ventas efectivo</p><p className="mt-1 break-words text-xl font-black">{formatMoney(openCash.cashSalesCents)}</p></div><div className="bg-ink p-4"><p className="text-sm text-white/60">Gastos efectivo</p><p className="mt-1 break-words text-xl font-black">-{formatMoney(openCash.cashExpensesCents)}</p></div><div className="bg-ink p-4"><p className="text-sm text-white/60">Caja esperada</p><p className="mt-1 break-words text-xl font-black text-accent">{formatMoney(openCash.expectedCashCents)}</p></div></div></div><CloseCashForm id={openCash.id} expectedCashCents={openCash.expectedCashCents} /></> : <OpenCashForm />}</section>
  <section className="mt-9"><h2 className="section-title">Mis cajas</h2>{history.length === 0 ? <div className="panel deeta-rule mt-4 text-center"><p className="font-black">Todavía no hay cajas registradas.</p><p className="mt-1 text-sm text-muted">Abrí la primera para controlar el efectivo del día.</p></div> : <div className="list-surface mt-4">{history.map((cash) => <Link key={cash.id} href={`/caja/${cash.id}`} className="group list-row transition-colors hover:bg-mint-50"><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{cash.status === "OPEN" ? "Caja abierta" : "Caja cerrada"}</p><p className="mt-1 text-sm text-muted">{dateLabel(cash.openedAt, cash.timezone)}</p></div><ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-1" aria-hidden="true" /></div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><p><span className="text-muted">Ventas </span><strong>{formatMoney(cash.cashSalesCents)}</strong></p><p><span className="text-muted">Gastos </span><strong>-{formatMoney(cash.cashExpensesCents)}</strong></p>{cash.differenceCents !== null && <p><span className="text-muted">Diferencia </span><strong className={cash.differenceCents === 0 ? "text-success" : "text-red-700"}>{formatMoney(cash.differenceCents)}</strong></p>}</div></div></Link>)}</div>}</section></div>;
}
