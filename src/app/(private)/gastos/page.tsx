import { CalendarDays, CircleX, Plus, Settings2, WalletCards } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { getBusinessOnboardingStateForUser } from "@/data/onboarding";
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
  // All queries are independent and scoped by the authenticated membership in SQL.
  const [context, categories, totals, expenses, onboarding] = await Promise.all([
    getExpenseContextForUser(session.user.id),
    getExpenseCategoriesForUser(session.user.id, true),
    getExpenseTotalsForUser(session.user.id),
    getExpensesForPeriodForUser(session.user.id, { period: selected, start: requestedStart, end: requestedEnd, categoryId: requestedCategory }),
    getBusinessOnboardingStateForUser(session.user.id),
  ]);
  if (!context) redirect("/onboarding");
  const neverRegistered = onboarding !== null && !onboarding.signals.hasExpenses;
  const header = <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="page-title">Gastos</h1><p className="page-lead">Registrá y entendé en qué estás gastando.</p></div>{!neverRegistered && <Link href="/gastos/nuevo" className="button-primary"><Plus className="size-5" aria-hidden="true" /> Anotar gasto</Link>}</div>;
  if (neverRegistered) {
    return <div>{header}<EmptyState icon={WalletCards} title="No registraste gastos todavía" description="Cuando cargues gastos como servicios, transporte o compras operativas, DEETA los tendrá en cuenta en tus análisis." actions={[{ label: "Anotar primer gasto", href: "/gastos/nuevo", icon: Plus }]} /></div>;
  }
  const categoryId = requestedCategory && categories.some((item) => item.id === requestedCategory) ? requestedCategory : undefined;
  const month = resolveAnalysisPeriod(context.today, "CURRENT_MONTH").current;
  const week = resolveAnalysisPeriod(context.today, "LAST_7_DAYS").current;
  const customStart = requestedStart ?? month.start;
  const customEnd = requestedEnd ?? context.today;
  const validCustomRange = customStart <= customEnd;
  const range = selected === "TODAY" ? { start: context.today, end: context.today } : selected === "WEEK" ? week : selected === "CUSTOM" && validCustomRange ? { start: customStart, end: customEnd } : month;
  const periodTotal = expenses.reduce((total, expense) => expense.status === "CANCELLED" ? total : total + expense.amountCents, 0);
  const periods = [["TODAY", "Hoy"], ["WEEK", "7 días"], ["MONTH", "Este mes"], ["CUSTOM", "Elegir fechas"]] as const;
  return <div>{header}
  <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
    <div><dt className="text-sm text-muted">Hoy</dt><dd className="figure text-2xl">{formatMoney(totals.todayCents)}</dd></div>
    <div><dt className="text-sm text-muted">Este mes</dt><dd className="figure text-2xl">{formatMoney(totals.monthCents)}</dd></div>
  </dl>
  <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
    <aside className="grid gap-4 lg:sticky lg:top-6" aria-label="Filtros de gastos">
      <nav className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:grid lg:overflow-visible" aria-label="Período de gastos">
        {periods.map(([value, label]) => <Link key={value} href={{ pathname: "/gastos", query: { period: value } }} className="chip lg:justify-start" aria-current={selected === value ? "page" : undefined}>{label}</Link>)}
      </nav>
      <form className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <input type="hidden" name="period" value={selected} />
        {selected === "CUSTOM" && <div className="grid grid-cols-2 gap-3 lg:grid-cols-1"><label className="field-label">Desde<input className="field-input" type="date" name="start" defaultValue={range.start} /></label><label className="field-label">Hasta<input className="field-input" type="date" name="end" defaultValue={range.end} /></label></div>}
        <label className="field-label">Categoría<select className="field-input" name="category" defaultValue={categoryId ?? ""}><option value="">Todas</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <button className="button-secondary w-full" type="submit">Aplicar filtros</button>
        <Link href="/gastos/categorias" className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-ink"><Settings2 className="size-4" aria-hidden="true" /> Administrar categorías</Link>
      </form>
    </aside>
    <section aria-labelledby="historial-gastos">
      <div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="historial-gastos" className="section-title">Historial</h2><p className="text-sm text-muted">Total del período <span className="font-semibold text-ink tabular-nums">{formatMoney(periodTotal)}</span></p></div>
      {expenses.length === 0 ? <div className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center"><CalendarDays className="mx-auto size-7 text-muted" aria-hidden="true" /><p className="mt-3 font-semibold">No hay gastos en este período.</p><p className="mt-1 text-sm text-muted">Podés cambiar los filtros o anotar un gasto nuevo.</p></div> : <ul className="list-surface">{expenses.map((expense) => { const cancelled = expense.status === "CANCELLED"; return <li key={expense.id} className="border-b border-line last:border-b-0"><Link href={`/gastos/${expense.id}`} className="flex min-w-0 items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"><div className="min-w-0 flex-1"><p className={`truncate font-semibold ${cancelled ? "text-muted line-through" : ""}`}>{expense.description}</p><p className="truncate text-sm text-muted">{expense.categoryName} · {methodLabels[expense.paymentMethod]} · {expense.expenseDate}</p>{cancelled && <p className="status mt-0.5 text-red-700"><CircleX className="size-3.5" aria-hidden="true" /> Cancelado</p>}</div><p className={`figure shrink-0 text-lg ${cancelled ? "text-muted line-through" : ""}`}>{formatMoney(expense.amountCents)}</p></Link></li>; })}</ul>}
    </section>
  </div>
  </div>;
}
