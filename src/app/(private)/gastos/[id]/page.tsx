import { ArrowLeft, Banknote, CalendarDays, Tag } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelExpenseForm } from "@/components/expenses/cancel-expense-form";
import { getExpenseContextForUser, getExpenseForUser } from "@/data/expenses";
import { formatMoney } from "@/lib/inventory";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

const methodLabels = { CASH: "Efectivo", TRANSFER: "Transferencia", CARD: "Tarjeta", OTHER: "Otro" } as const;

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "EXPENSE_VIEW")) return <NoAccess section="Gastos" />;
  const membership = await getActiveMembership(session.user.id);
  const [expense, context] = await Promise.all([getExpenseForUser(session.user.id, id), getExpenseContextForUser(session.user.id)]);
  if (!expense || !context) notFound();
  const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${expense.expenseDate}T12:00:00Z`));
  return <div className="mx-auto max-w-2xl"><Link href="/gastos" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Volver a gastos</Link><section className={`mt-6 rounded-2xl p-6 sm:p-8 ${expense.status === "CANCELLED" ? "bg-[#eef0ed] text-muted" : "bg-ink text-white"}`}><p className="text-sm font-bold">{expense.status === "CANCELLED" ? "Gasto cancelado" : "Gasto"}</p><h1 className="mt-3 text-3xl font-black">{expense.description}</h1><p className="mt-5 text-4xl font-black">{formatMoney(expense.amountCents)}</p><div className="mt-7 grid gap-3 text-sm sm:grid-cols-3"><p><Tag className="mr-2 inline size-4" />{expense.categoryName}</p><p><Banknote className="mr-2 inline size-4" />{methodLabels[expense.paymentMethod]}</p><p><CalendarDays className="mr-2 inline size-4" />{date}</p></div></section>{expense.cashSessionId && <p className="notice-success mt-5">Este gasto se asoció a la caja abierta y redujo el efectivo esperado.</p>}{expense.status === "CANCELLED" ? <div className="panel mt-5"><p className="font-black">Cancelado</p><p className="mt-2 text-sm text-muted">{expense.cancellationReason || "Sin motivo informado."}</p></div> : can(membership, "EXPENSE_CANCEL") ? <CancelExpenseForm expenseId={expense.id} /> : null}</div>;
}
