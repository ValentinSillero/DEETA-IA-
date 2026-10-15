import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Box, CalendarDays, CheckCircle2, Clock3, HelpCircle, Minus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EvolutionChart } from "@/components/analytics/evolution-chart";
import { getAnalyticsContextForUser } from "@/data/analytics-context";
import { getIntelligentAnalyticsForUser, type IntelligentProduct } from "@/data/intelligent-analytics";
import { buildAnalysisSummary, comparisonChangeText, comparisonLabel, comparisonReference, formatAnalysisMoney, metricExplanation } from "@/lib/analytics-presentation";
import { formatMoney } from "@/lib/inventory";
import { resolveAnalysisPeriod, resolveCustomPeriod, type AnalysisPeriod } from "@/lib/periods";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Análisis" };
const periods: Array<{ value: AnalysisPeriod | "CUSTOM"; label: string }> = [
  { value: "TODAY", label: "Hoy" }, { value: "LAST_7_DAYS", label: "7 días" }, { value: "LAST_30_DAYS", label: "30 días" },
  { value: "CURRENT_MONTH", label: "Este mes" }, { value: "PREVIOUS_MONTH", label: "Mes anterior" }, { value: "CUSTOM", label: "Elegir fechas" },
];

function localToday(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
function shortDate(value: string) { return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`)); }
function Change({ value, reference, inverse = false }: { value: number | null; reference: string; inverse?: boolean }) {
  if (value === null) return <span className="text-xs font-bold leading-5 text-muted">{comparisonChangeText(value, reference)}</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const positive = inverse ? value < 0 : value > 0;
  return <span className={`inline-flex items-start gap-1.5 text-xs font-black leading-5 ${value === 0 ? "text-muted" : positive ? "text-success" : "text-red-700"}`}><Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="sr-only">{value > 0 ? "Subió " : value < 0 ? "Bajó " : ""}</span>{comparisonChangeText(value, reference)}</span>;
}
type MetricKey = "sales" | "grossMargin" | "expenses" | "estimatedResult" | "averageTicket";
type Metric = { key: MetricKey; label: string; definition: string | null; value: number; change: number | null; inverse: boolean };
function MetricCard({ metric, reference, prominent = false }: { metric: Metric; reference: string; prominent?: boolean }) {
  const isNegativeResult = metric.key === "estimatedResult" && metric.value < 0;
  return <article className={`deeta-rule min-w-0 rounded-2xl border p-4 sm:p-5 ${prominent ? "border-mint-200 bg-mint-50/60 lg:p-6" : "border-line bg-surface"}`}>
    <p className="text-sm font-black leading-5 text-ink">{metric.label}</p>
    <p className={`mt-1 break-words font-black tracking-[-0.035em] ${prominent ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"} ${isNegativeResult ? "text-red-700" : "text-ink"}`}>{formatAnalysisMoney(metric.value)}</p>
    <div className="mt-2"><Change value={metric.change} reference={reference} inverse={metric.inverse} /></div>
    <p className={`mt-2 text-sm font-semibold leading-5 ${isNegativeResult ? "text-red-700" : "text-muted"}`}>{metricExplanation({ key: metric.key, currentCents: metric.value, change: metric.change, reference })}</p>
    {metric.definition ? <details className="mt-2 border-t border-line pt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-black text-muted hover:text-ink"><HelpCircle className="size-4 shrink-0" aria-hidden="true" /> ¿Qué significa?</summary>
      <p className="pb-1 text-sm leading-6 text-muted">{metric.definition}</p>
    </details> : null}
  </article>;
}
function ProductRow({ product, value, detail }: { product: IntelligentProduct; value: string; detail: string }) { return <div className="flex min-w-0 items-start justify-between gap-3 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0"><div className="min-w-0"><p className="truncate font-black">{product.name}</p><p className="mt-1 text-xs text-muted">{detail}</p></div><p className="shrink-0 text-right font-black">{value}</p></div>; }
function Priority({ value }: { value: IntelligentProduct["reorderPriority"] }) { const styles = value === "URGENT" ? "bg-red-100 text-red-700" : value === "SOON" ? "bg-orange-100 text-orange-700" : "bg-accent-soft text-success"; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${styles}`}>{value === "URGENT" ? "Urgente" : value === "SOON" ? "Próximamente" : "Bien"}</span>; }

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }> }) {
  const session = await requireSession(); const [params, analyticsContext] = await Promise.all([searchParams, getAnalyticsContextForUser(session.user.id)]);
  if (!analyticsContext) redirect("/onboarding");
  const today = localToday(analyticsContext.timezone); const requested = periods.some((item) => item.value === params.periodo) ? params.periodo as AnalysisPeriod | "CUSTOM" : "CURRENT_MONTH";
  const period = requested; let customError = false; let ranges;
  if (period === "CUSTOM") {
    if (!params.desde || !params.hasta) ranges = resolveAnalysisPeriod(today, "LAST_30_DAYS");
    else {
      try { ranges = resolveCustomPeriod(today, params.desde, params.hasta); }
      catch { customError = true; ranges = resolveAnalysisPeriod(today, "LAST_30_DAYS"); }
    }
  } else ranges = resolveAnalysisPeriod(today, period);
  const analytics = await getIntelligentAnalyticsForUser(session.user.id, ranges); if (!analytics) redirect("/onboarding"); const financial = analytics.financial;
  const reference = comparisonReference(period);
  const metrics = [
    { key: "estimatedResult" as const, label: "Resultado estimado", definition: "Margen bruto menos los gastos registrados.", value: financial.current.estimatedResultCents, change: financial.comparisons.estimatedResult, inverse: false },
    { key: "sales" as const, label: "Ventas", definition: null, value: financial.current.salesCents, change: financial.comparisons.sales, inverse: false },
    { key: "grossMargin" as const, label: "Margen bruto", definition: "Ventas menos el costo de los productos vendidos.", value: financial.current.grossMarginCents, change: financial.comparisons.grossMargin, inverse: false },
    { key: "expenses" as const, label: "Gastos", definition: null, value: financial.current.expensesCents, change: financial.comparisons.expenses, inverse: true },
    { key: "averageTicket" as const, label: "Promedio por venta", definition: "Ventas totales divididas por la cantidad de ventas.", value: financial.current.averageTicketCents, change: financial.comparisons.averageTicket, inverse: false },
  ] satisfies Metric[];
  const summary = buildAnalysisSummary({
    operations: financial.current.operations,
    grossMarginCents: financial.current.grossMarginCents,
    expensesCents: financial.current.expensesCents,
    estimatedResultCents: financial.current.estimatedResultCents,
    reference,
    comparisons: {
      sales: financial.comparisons.sales,
      expenses: financial.comparisons.expenses,
      estimatedResult: financial.comparisons.estimatedResult,
    },
  });
  const hasDetailedData = financial.current.operations > 0
    || analytics.inventory.immobilizedProducts.length > 0
    || analytics.inventory.reorderCandidates.length > 0
    || analytics.inventory.buyLessCandidates.length > 0;
  return <div><header><p className="section-label">Mi negocio</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Análisis</h1><p className="mt-2 max-w-2xl leading-7 text-muted">Datos claros para decidir mejor. Las estimaciones usan tus ventas registradas y nunca cambian stock, precios ni compras.</p></header>
    <nav className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Período de análisis">{periods.map((item) => <Link key={item.value} href={item.value === "CUSTOM" ? "/analisis?periodo=CUSTOM" : `/analisis?periodo=${item.value}`} className={`min-h-11 rounded-lg border px-3 py-3 text-center text-sm font-black ${period === item.value ? "border-ink bg-ink text-white" : "border-line bg-surface"}`}>{item.label}</Link>)}</nav>
    {period === "CUSTOM" && <form className="panel mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="field-label">Desde<input className="field-input" type="date" name="desde" defaultValue={params.desde} max={today} required /></label><label className="field-label">Hasta<input className="field-input" type="date" name="hasta" defaultValue={params.hasta} max={today} required /></label><input type="hidden" name="periodo" value="CUSTOM" /><button className="button-primary" type="submit">Ver período</button></form>}
    {customError && <p className="notice-error mt-3">Elegí fechas válidas, de hasta 366 días y sin incluir días futuros.</p>}
    <div className="mt-4 flex flex-col gap-1 text-sm"><p className="font-black text-ink">{shortDate(ranges.current.start)} – {shortDate(ranges.current.end)}</p><p className="font-bold text-muted">{comparisonLabel(period)}</p></div>
    <section className="deeta-rule mt-5 rounded-2xl border border-mint-200 bg-mint-50 p-4 sm:p-5" aria-labelledby="plain-summary-title"><div className="flex items-center gap-2"><CheckCircle2 className="size-5 shrink-0 text-mint-600" aria-hidden="true" /><h2 id="plain-summary-title" className="text-lg font-black">En pocas palabras</h2></div><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-ink sm:text-base">{summary.join(" ")}</p></section>
    <section className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.95fr)]">
      <MetricCard metric={metrics[0]} reference={reference} prominent />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">{metrics.slice(1).map((metric) => <MetricCard key={metric.key} metric={metric} reference={reference} />)}</div>
    </section>
    {!hasDetailedData ? <section className="panel deeta-rule mt-6 text-center"><BarChart3 className="mx-auto size-10 text-mint-600" aria-hidden="true" /><h2 className="mt-4 text-xl font-black">Todavía no hay información para analizar</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Registrá ventas y cargá tus productos. Cuando haya movimiento, DEETA va a explicarte qué cambió y qué conviene revisar.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Link href="/vender" className="button-primary">Registrar una venta</Link><Link href="/productos" className="button-secondary">Revisar productos</Link></div></section> : <>
    <section className="panel mt-5"><div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-sm font-bold text-muted">Evolución diaria</p><h2 className="mt-1 text-2xl font-black">Ventas, margen bruto y gastos</h2></div><p className="text-sm text-muted sm:text-right"><strong className="text-ink">{financial.current.operations}</strong> ventas registradas</p></div><div className="mt-5"><EvolutionChart values={analytics.evolution.map(({ date, salesCents, grossMarginCents, expensesCents }) => ({ date, salesCents, grossMarginCents, expensesCents }))} /></div></section>
    <section className="mt-8"><div className="flex items-center gap-2"><Sparkles className="size-6 text-mint-600" aria-hidden="true" /><h2 className="section-title">Para tener en cuenta</h2></div><div className="list-surface mt-4">{analytics.insights.length === 0 ? <div className="deeta-rule p-5 text-muted">Todavía no hay suficiente información para generar recomendaciones útiles.</div> : analytics.insights.map((insight) => <article key={`${insight.type}-${insight.title}`} className="deeta-rule border-b border-line bg-surface p-5 last:border-b-0"><p className="text-xs font-black uppercase tracking-wide text-mint-600">{insight.severity === "HIGH" ? "Atención" : "Dato útil"}</p><h3 className="mt-2 text-lg font-black">{insight.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{insight.explanation}</p><details className="mt-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black"><HelpCircle className="size-4" aria-hidden="true" /> ¿Por qué DEETA me dice esto?</summary><dl className="mt-3 grid gap-2 text-sm">{insight.evidence.map((item) => <div key={item.label} className="flex justify-between gap-3"><dt className="text-muted">{item.label}</dt><dd className="text-right font-black">{item.value}</dd></div>)}</dl></details></article>)}</div></section>
    <section className="mt-8 min-w-0"><h2 className="text-2xl font-black">Productos</h2><p className="mt-1 text-sm text-muted">Unidades, facturación y margen son rankings distintos.</p><div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-3"><div className="panel min-w-0"><h3 className="font-black">Más vendidos</h3><p className="mb-4 text-xs text-muted">Por cantidad de unidades</p>{analytics.rankings.byUnits.length ? analytics.rankings.byUnits.map((product) => <ProductRow key={product.productId} product={product} value={`${product.units} u.`} detail={formatMoney(product.salesCents)} />) : <p className="text-sm text-muted">Sin ventas en el período.</p>}</div><div className="panel min-w-0"><h3 className="font-black">Mayor facturación</h3><p className="mb-4 text-xs text-muted">Por dinero vendido</p>{analytics.rankings.byRevenue.length ? analytics.rankings.byRevenue.map((product) => <ProductRow key={product.productId} product={product} value={formatMoney(product.salesCents)} detail={`${product.units} unidades`} />) : <p className="text-sm text-muted">Sin ventas en el período.</p>}</div><div className="panel min-w-0"><h3 className="font-black">Mayor margen</h3><p className="mb-4 text-xs text-muted">Con el costo guardado al vender</p>{analytics.rankings.byProfitability.length ? analytics.rankings.byProfitability.map((product) => <ProductRow key={product.productId} product={product} value={formatMoney(product.grossMarginCents)} detail={`Costo ${formatMoney(product.cogsCents)} · ${product.marginPercent ?? "—"}%`} />) : <p className="text-sm text-muted">Sin ventas en el período.</p>}</div></div></section>
    <section className="mt-8 grid min-w-0 gap-5 lg:grid-cols-2"><div className="min-w-0"><h2 className="text-2xl font-black">Días y horarios</h2><div className="panel mt-4 min-w-0">{!analytics.patterns.sufficient ? <div className="text-center"><CalendarDays className="mx-auto size-8 text-muted" /><p className="mt-3 font-black">Necesitamos algunos días más</p><p className="mt-2 text-sm leading-6 text-muted">{analytics.patterns.reason}</p></div> : <div className="grid gap-5 sm:grid-cols-2"><div><CalendarDays className="size-5 text-mint-600" /><p className="mt-2 text-sm text-muted">Día más fuerte</p><p className="text-xl font-black">{analytics.patterns.strongestDay?.weekday}</p><p className="mt-1 text-sm">{formatMoney(analytics.patterns.strongestDay?.salesCents ?? 0)}</p></div><div><Clock3 className="size-5 text-mint-600" /><p className="mt-2 text-sm text-muted">Horario más fuerte</p><p className="text-xl font-black">{analytics.patterns.strongestHour?.band}</p><p className="mt-1 text-sm">{analytics.patterns.strongestHour?.operations} ventas · {formatMoney(analytics.patterns.strongestHour?.salesCents ?? 0)}</p></div></div>}</div></div><div className="min-w-0"><h2 className="text-2xl font-black">Margen bajo</h2><div className="panel mt-4 min-w-0">{analytics.rankings.lowestMargin.length === 0 ? <p className="text-muted">No hay ventas para comparar márgenes.</p> : analytics.rankings.lowestMargin.map((product) => <ProductRow key={product.productId} product={product} value={`${product.marginPercent ?? "—"}%`} detail={`Margen ${formatMoney(product.grossMarginCents)}`} />)}</div></div></section>
    <section className="mt-8 min-w-0"><div className="flex items-center gap-2"><Box className="size-6 text-mint-600" /><h2 className="text-2xl font-black">Stock</h2></div><p className="mt-1 text-sm text-muted">Velocidad y cobertura estimadas con los últimos {analytics.inventoryDays} días calendario, incluso los días sin ventas.</p><div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[0.9fr_1.1fr]"><article className="min-w-0 rounded-[28px] border border-orange-100 bg-[#fffaf4] p-5 sm:p-7"><p className="text-sm font-bold text-muted">Capital aproximado en mercadería con poco movimiento</p><p className="mt-2 break-words text-3xl font-black">{formatMoney(analytics.inventory.immobilizedValueCents)}</p><p className="mt-3 text-sm leading-6 text-muted">Productos con stock y una venta o menos en 60 días. Usa el costo actual solo para estimar el valor del stock de hoy.</p>{analytics.inventory.immobilizedProducts.slice(0, 4).map((product) => <div key={product.productId} className="mt-3 flex min-w-0 justify-between gap-3 text-sm"><span className="min-w-0 truncate">{product.name} · {product.currentStock} u.</span><strong className="shrink-0">{formatMoney(product.immobilizedValueCents)}</strong></div>)}</article><div className="panel min-w-0"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="font-black">Reposición aproximada</h3><p className="text-xs text-muted">Reglas transparentes, no una predicción exacta</p></div><AlertTriangle className="size-5 shrink-0 text-orange-500" /></div><div className="mt-4 grid min-w-0 gap-3">{analytics.inventory.reorderCandidates.length === 0 ? <p className="text-sm text-muted">No detectamos productos para revisar ahora.</p> : analytics.inventory.reorderCandidates.slice(0, 8).map((product) => <article key={product.productId} className="min-w-0 rounded-2xl border border-line p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{product.name}</p><p className="mt-1 text-xs text-muted">Stock {product.currentStock} · Mínimo {product.minimumStock} · {product.averageDailySales} por día</p></div><Priority value={product.reorderPriority} /></div><p className="mt-2 text-sm">{product.estimatedDaysRemaining === null ? "Sin ventas suficientes para estimar cuánto durará." : `Al ritmo actual, podría alcanzar para aproximadamente ${product.estimatedDaysRemaining} días.`}{product.confidence === "LOW" ? " Estimación con pocos datos." : ""}</p></article>)}</div></div></div></section>
    <section className="mt-8 grid min-w-0 gap-5 lg:grid-cols-2"><div className="min-w-0"><h2 className="text-2xl font-black">Poco movimiento</h2><div className="panel mt-4 min-w-0">{analytics.rankings.slowMoving.length === 0 ? <p className="text-muted">No encontramos productos maduros con poco movimiento en este período.</p> : analytics.rankings.slowMoving.map((product) => <ProductRow key={product.productId} product={product} value={`${product.currentStock} en stock`} detail={`${product.units} vendidas · Última venta ${product.lastSale ? shortDate(product.lastSale) : "sin registro reciente"}`} />)}<p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-muted">Los productos con menos de 14 días no se marcan como problemáticos.</p></div></div><div className="min-w-0"><h2 className="text-2xl font-black">Comprar menos</h2><div className="panel mt-4 min-w-0">{analytics.inventory.buyLessCandidates.length === 0 ? <p className="text-muted">No hay candidatos claros en este momento.</p> : analytics.inventory.buyLessCandidates.slice(0, 6).map((product) => <ProductRow key={product.productId} product={product} value={formatMoney(product.immobilizedValueCents)} detail={`${product.currentStock} unidades · ${product.unitsLast60Days} vendidas en 60 días`} />)}<p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-muted">Es una invitación a revisar la próxima compra. DEETA no cambia cantidades, precios ni promociones.</p></div></div></section>
    </>}
    <footer className="deeta-rule mt-8 rounded-xl border border-line bg-surface p-4 text-xs leading-5 text-muted"><BarChart3 className="mb-2 size-5" aria-hidden="true" />Los importes históricos usan costos guardados en cada venta. Las ventas canceladas y los gastos cancelados quedan excluidos. El resultado es estimado y no reemplaza contabilidad formal.</footer>
  </div>;
}
