import { ArrowRight, CircleX, Plus, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { getSalesForUser } from "@/data/sales";
import { formatMoney } from "@/lib/inventory";
import { PAYMENT_METHOD_LABELS, saleDisplayNumber } from "@/lib/sales";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Ventas" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Montevideo" }).format(date);
}

export default async function SalesPage() {
  const session = await requireSession();
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "SALE_VIEW")) return <NoAccess section="Ventas" />;
  const sales = await getSalesForUser(session.user.id);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Ventas</h1>
          <p className="page-lead">El registro de todas las operaciones del negocio.</p>
        </div>
        {sales.length > 0 && <Link href="/vender" className="button-brand"><Plus className="size-5" aria-hidden="true" /> Nueva venta</Link>}
      </div>

      {sales.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Todavía no registraste ventas" description="Tu historial aparecerá acá después de tu primera venta." actions={[{ label: "Nueva venta", href: "/vender", icon: Plus }]} />
      ) : (
        <section className="list-surface mt-6" aria-label="Historial de ventas">
          <div className="hidden grid-cols-[7rem_minmax(0,1fr)_8rem_6rem_8rem_1rem] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-xs font-semibold text-muted md:grid" aria-hidden="true">
            <span>Venta</span><span>Fecha</span><span>Pago</span><span className="text-right">Unidades</span><span className="text-right">Total</span><span />
          </div>
          <ul>
            {sales.map((sale) => {
              const cancelled = sale.status === "CANCELLED";
              return (
                <li key={sale.id} className="border-b border-line last:border-b-0">
                  <Link href={`/ventas/${sale.id}`} className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5 md:grid-cols-[7rem_minmax(0,1fr)_8rem_6rem_8rem_1rem]">
                    <span className="font-semibold tabular-nums">#{saleDisplayNumber(sale.id)}</span>
                    <span className="order-3 col-span-2 truncate text-sm text-muted md:order-none md:col-span-1 md:text-[0.95rem] md:text-ink">
                      {formatDate(sale.createdAt)}
                      <span className="md:hidden"> · {PAYMENT_METHOD_LABELS[sale.paymentMethod]} · {sale.unitCount} u.</span>
                      {sale.customerName && <span className="block truncate text-sm text-muted">{sale.customerName}</span>}
                    </span>
                    <span className="hidden text-sm md:block">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</span>
                    <span className="hidden text-right tabular-nums md:block">{sale.unitCount}</span>
                    <span className="text-right">
                      <span className={`figure text-lg md:text-base ${cancelled ? "text-muted line-through" : ""}`}>{formatMoney(sale.totalCents)}</span>
                      {cancelled && <span className="status ml-2 text-red-700"><CircleX className="size-3.5" aria-hidden="true" /> Cancelada</span>}
                    </span>
                    <ArrowRight className="hidden size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink md:block" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
