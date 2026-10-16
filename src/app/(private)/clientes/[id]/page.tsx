import { ArrowLeft, CircleCheck, Pencil, Phone, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerAdjustmentForm, CustomerPaymentForm } from "@/components/customers/customer-forms";
import { getOpenCashSessionForUser } from "@/data/cash";
import { getCustomerForUser } from "@/data/customers";
import { customerMovementLabel, relativeDaysLabel } from "@/lib/customers";
import { formatMoney } from "@/lib/inventory";
import { saleDisplayNumber } from "@/lib/sales";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([requireSession(), params]);
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "CUSTOMER_VIEW")) return <NoAccess section="Clientes" />;
  const membership = await getActiveMembership(session.user.id);
  const [customer, openCash] = await Promise.all([
    getCustomerForUser(session.user.id, id),
    getOpenCashSessionForUser(session.user.id),
  ]);
  if (!customer) notFound();
  const dateLabel = (date: Date) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: customer.timezone }).format(date);
  const timeLabel = (date: Date) => new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: customer.timezone }).format(date);
  const hasDebt = customer.balanceCents > 0;

  return (
    <div>
      <Link href="/clientes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a clientes</Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title break-words">{customer.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {customer.phone && <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-9 items-center gap-1.5 hover:text-ink"><Phone className="size-4" aria-hidden="true" />{customer.phone}</a>}
            <span>Último movimiento: {relativeDaysLabel(customer.lastMovementAt)}</span>
            {!customer.isActive && <span className="font-semibold text-[#a8530f]">Desactivado</span>}
          </p>
        </div>
        {can(membership, "CUSTOMER_EDIT") && <Link href={`/clientes/${customer.id}/editar`} className="button-quiet min-h-10 px-3 text-sm"><Pencil className="size-4" aria-hidden="true" /> Editar cliente</Link>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid gap-6">
          {/* Saldo: lo primero que hay que leer. */}
          <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label="Saldo">
            <div>
              <p className="text-sm font-semibold text-muted">{hasDebt ? "Debe" : "Saldo"}</p>
              <p className={`figure mt-0.5 text-[2.5rem] leading-none ${hasDebt ? "" : "text-success"}`}>{formatMoney(customer.balanceCents)}</p>
              {!hasDebt && <p className="status mt-2 text-sm text-success"><CircleCheck className="size-4" aria-hidden="true" /> Al día</p>}
            </div>
            {customer.isActive && can(membership, "SALE_CREATE") && <Link href={`/vender?cliente=${customer.id}`} className="button-secondary"><ShoppingCart className="size-5" aria-hidden="true" /> Nueva venta</Link>}
          </section>

          <section aria-labelledby="historial-cliente">
            <h2 id="historial-cliente" className="section-title mb-3">Cuenta corriente</h2>
            {customer.movements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong px-5 py-6 text-center">
                <p className="font-semibold">Todavía no hay movimientos.</p>
                <p className="mt-1 text-sm text-muted">Las ventas fiadas y los pagos de este cliente van a aparecer acá.</p>
              </div>
            ) : (
              <ol className="list-surface">
                {customer.movements.map((movement) => (
                  <li key={movement.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-line px-4 py-3 last:border-b-0 sm:px-5">
                    <p className="pt-0.5 text-sm font-semibold leading-tight text-muted">{dateLabel(movement.createdAt)}<span className="block whitespace-nowrap text-xs font-normal">{timeLabel(movement.createdAt)}</span></p>
                    <div className="min-w-0">
                      <p className="font-semibold">{customerMovementLabel(movement.type, movement.amountCents, movement.paymentMethod)}</p>
                      <p className="text-sm text-muted">
                        {movement.saleId && <Link href={`/ventas/${movement.saleId}`} className="underline decoration-line-strong underline-offset-4 hover:text-ink">Venta #{saleDisplayNumber(movement.saleId)}</Link>}
                        {movement.saleId && movement.note ? " · " : ""}
                        {movement.note}
                        {(movement.saleId || movement.note) ? " · " : ""}{movement.createdByName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold tabular-nums ${movement.amountCents > 0 ? "text-ink" : "text-success"}`}>{movement.amountCents > 0 ? "+" : "−"}{formatMoney(Math.abs(movement.amountCents))}</p>
                      <p className="text-xs text-muted tabular-nums">Saldo {formatMoney(movement.balanceAfterCents)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-6">
          {can(membership, "CUSTOMER_PAYMENT") && <CustomerPaymentForm customerId={customer.id} balanceCents={customer.balanceCents} hasOpenCash={Boolean(openCash)} initialKey={crypto.randomUUID()} />}
          {can(membership, "CUSTOMER_ADJUSTMENT") && <CustomerAdjustmentForm customerId={customer.id} initialKey={crypto.randomUUID()} />}
          {customer.notes && <div className="rounded-2xl border border-line bg-surface p-5 text-sm"><p className="font-semibold">Notas</p><p className="mt-1 whitespace-pre-wrap leading-6 text-muted">{customer.notes}</p></div>}
        </aside>
      </div>
    </div>
  );
}
