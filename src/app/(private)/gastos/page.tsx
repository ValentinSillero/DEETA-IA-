import { CalendarDays, Plus, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getExpenseCategoriesForUser, getExpenseContextForUser, getExpensesForPeriodForUser, getExpenseTotalsForUser } from "@/data/expenses";
import { formatMoney } from "@/lib/inventory";
import { resolveAnalysisPeriod } from "@/lib/periods";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Gastos" };
const methodLabels = { CASH: "Efectivo", TRANSFER: "Transferencia", CARD: "Tarjeta", OTHER: "Otro" } as const;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const requestedPeriod = typeof params.period === "string" ? params.period : "MONTH";
  const selected = (["TODAY", "WEEK", "MONTH", "CUSTOM"] as const).find((value) => value === requestedPeriod) ?? "MONTH";
  const requestedStart = typeof params.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.start) ? params.start : undefined;
  const requestedEnd = typeof params.end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.end) ? params.end : undefined;
  const requestedCategory = typeof params.category === "string" ? params.category : undefined;
  // All four queries are independent and scoped by the authenticated membership in SQL.
  const [context, categories, totals, expenses] = await Promise.all([
    getExpenseContextForUser(session.user.id),
    getExpenseCategoriesForUser(session.user.id, true),
    getExpenseTotalsForUser(session.user.id),
    getExpensesForPeriodForUser(session.user.id, { period: selected, start: requestedStart, end: requestedEnd, categoryId: requestedCategory }),
  ]);
  if (!context) redirect("/onboarding");
  const categoryId = requestedCategory && categories.some((item) => item.id === requestedCategory) ? requestedCategory : undefined;
  const month = resolveAnalysisPeriod(context.today, "CURRENT_MONTH").current;
  const week = resolveAnalysisPeriod(context.today, "LAST_7_DAYS").current;
  const customStart = requestedStart ?? month.start;
  const customEnd = requestedEnd ?? context.today;
  const validCustomRange = customStart <= customEnd;
  const range = selected === "TODAY" ? { start: context.today, end: context.today } : selected === "WEEK" ? week : selected === "CUSTOM" && validCustomRange ? { start: customStart, end: customEnd } : month;
  return <div><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-label text-orange-500">Tu dinero</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Gastos</h1><p className="mt-2 text-muted">Registrá y entendé en qué estás gastando.</p></div><Link href="/gastos/nuevo" className="button-primary"><Plus className="size-5" aria-hidden="true" /> Anotar gasto</Link></div>
  <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line"><div className="bg-surface p-5"><p className="text-sm font-bold text-muted">Hoy</p><p className="mt-2 break-words text-2xl font-black">{formatMoney(totals.todayCents)}</p></div><div className="bg-surface p-5"><p className="text-sm font-bold text-muted">Este mes</p><p className="mt-2 break-words text-2xl font-black">{formatMoney(totals.monthCents)}</p></div></section>
  <div className="panel mt-5"><nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Período de gastos">{[["TODAY","Hoy"],["WEEK","Esta semana"],["MONTH","Este mes"],["CUSTOM","Período"]].map(([value,label]) => <Link key={value} href={{ pathname: "/gastos", query: { period: value } }} className={`rounded-xl border px-3 py-3 text-center text-sm font-black ${selected === value ? "border-ink bg-mint-100" : "border-line"}`}>{label}</Link>)}</nav><form className="mt-4"><input type="hidden" name="period" value={selected} />{selected === "CUSTOM" && <div className="grid grid-cols-2 gap-3"><label className="field-label">Desde<input className="field-input" type="date" name="start" defaultValue={range.start} /></label><label className="field-label">Hasta<input className="field-input" type="date" name="end" defaultValue={range.end} /></label></div>}<label className="field-label mt-4">Categoría<select className="field-input" name="category" defaultValue={categoryId ?? ""}><option value="">Todas</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="button-secondary mt-4 w-full" type="submit">Aplicar filtros</button></form></div>
  <div className="mt-7 flex items-center justify-between"><h2 className="section-title">Historial</h2><Link href="/gastos/categorias" className="inline-flex items-center gap-2 text-sm font-bold text-muted"><Settings2 className="size-4" aria-hidden="true" /> Categorías</Link></div>{expenses.length === 0 ? <div className="panel deeta-rule mt-4 text-center"><CalendarDays className="mx-auto size-9 text-muted" aria-hidden="true" /><p className="mt-3 font-black">No hay gastos en este período.</p><p className="mt-1 text-sm text-muted">Podés cambiar los filtros o anotar un gasto nuevo.</p></div> : <div className="list-surface mt-4">{expenses.map((expense) => <Link key={expense.id} href={`/gastos/${expense.id}`} className={`list-row ${expense.status === "CANCELLED" ? "bg-[#f3f2f8] opacity-70" : "bg-surface hover:bg-orange-100"}`}><div className="min-w-0 flex-1"><p className="truncate font-black">{expense.description}</p><p className="mt-1 truncate text-sm text-muted">{expense.categoryName} · {methodLabels[expense.paymentMethod]}</p><p className="mt-2 text-xs font-bold text-muted">{expense.expenseDate}{expense.status === "CANCELLED" ? " · CANCELADO" : ""}</p></div><p className="shrink-0 text-lg font-black">{formatMoney(expense.amountCents)}</p></Link>)}</div>}</div>;
}
