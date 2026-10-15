import { ArrowRight, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CloseCashForm, OpenCashForm } from "@/components/cash/cash-forms";
import { CashDifference, CashStatement } from "@/components/cash/cash-statement";
import { getCashSessionsForUser } from "@/data/cash";
import { formatMoney } from "@/lib/inventory";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Caja" };

function dateLabel(date: Date, timezone: string) { return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(date); }
function timeLabel(date: Date, timezone: string) { return new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: timezone }).format(date); }

const steps = [
  "Al empezar, indicás con cuánto efectivo arrancás.",
  "DEETA suma las ventas y resta los gastos en efectivo.",
  "Al cerrar, contás el dinero y ves si coincide con lo esperado.",
];

export default async function CashPage() {
  const session = await requireSession();
  const history = await getCashSessionsForUser(session.user.id);
  const openCash = history.find((cash) => cash.status === "OPEN") ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Caja</h1>
          <p className="page-lead">El efectivo del día: con cuánto abriste, cuánto entró y cuánto debería haber.</p>
        </div>
        <p className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">
          <span className={`size-2.5 rounded-full ${openCash ? "bg-success" : "bg-line-strong"}`} aria-hidden="true" />
          {openCash ? `Abierta desde las ${timeLabel(openCash.openedAt, openCash.timezone)}` : "Caja cerrada"}
        </p>
      </div>

      {openCash ? (
        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start" aria-label="Caja abierta">
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="section-title">Hoja de caja</h2>
              <p className="text-sm text-muted">{openCash.cashOperations} {openCash.cashOperations === 1 ? "venta" : "ventas"} en efectivo</p>
            </div>
            <div className="mt-3"><CashStatement cash={openCash} size="large" /></div>
          </div>
          <CloseCashForm id={openCash.id} expectedCashCents={openCash.expectedCashCents} />
        </section>
      ) : (
        <section className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start" aria-label="Abrir caja">
          {history.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:order-2">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                  <h2 className="section-title">¿Para qué sirve la caja?</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">Abrí una caja para controlar el efectivo del día.</p>
                </div>
              </div>
              <ol className="mt-4 grid gap-3 text-sm leading-6">
                {steps.map((text, index) => (
                  <li key={text} className="flex gap-3"><span className="figure w-5 shrink-0 text-base text-brand">{index + 1}</span><span>{text}</span></li>
                ))}
              </ol>
              <p className="mt-4 border-t border-line pt-3 text-xs leading-5 text-muted">Las ventas con transferencia o tarjeta no necesitan caja abierta.</p>
            </div>
          )}
          <OpenCashForm />
        </section>
      )}

      <section className="mt-9" aria-labelledby="historial-cajas">
        <h2 id="historial-cajas" className="section-title">Historial</h2>
        {history.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line-strong px-5 py-6 text-center">
            <p className="font-semibold">Todavía no abriste ninguna caja.</p>
            <p className="mt-1 text-sm text-muted">Cuando abras y cierres cajas, vas a ver el historial acá.</p>
          </div>
        ) : (
          <div className="list-surface mt-3">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_1rem] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-xs font-semibold text-muted md:grid" aria-hidden="true">
              <span>Apertura</span><span className="text-right">Ventas efectivo</span><span className="text-right">Gastos efectivo</span><span className="text-right">Cierre</span><span />
            </div>
            <ul>
              {history.map((cash) => (
                <li key={cash.id} className="border-b border-line last:border-b-0">
                  <Link href={`/caja/${cash.id}`} className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_1rem]">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{dateLabel(cash.openedAt, cash.timezone)}</span>
                      <span className="block truncate text-sm text-muted">{cash.status === "OPEN" ? "Abierta" : "Cerrada"} · {cash.openedByName}</span>
                    </span>
                    <span className="text-right text-sm md:text-[0.95rem]"><span className="text-muted md:hidden">Ventas </span><span className="font-semibold tabular-nums">{formatMoney(cash.cashSalesCents)}</span></span>
                    <span className="hidden text-right font-semibold tabular-nums md:block">−{formatMoney(cash.cashExpensesCents)}</span>
                    <span className="col-span-2 md:col-span-1 md:text-right">{cash.differenceCents !== null ? <CashDifference cents={cash.differenceCents} /> : <span className="status text-sm text-muted">En curso</span>}</span>
                    <ArrowRight className="hidden size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink md:block" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
