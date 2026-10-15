import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bot,
  Camera,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  Package,
  Plus,
  ReceiptText,
  Settings,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { getFinancialSummaryForUser } from "@/data/analytics";
import { getBusinessForUser } from "@/data/businesses";
import { getOpenCashSessionForUser } from "@/data/cash";
import { getDashboardDetectionsForUser } from "@/data/intelligent-analytics";
import { getProductCountsForUser } from "@/data/products";
import { buildDeterministicInsights } from "@/lib/ai/insights";
import { formatMoney } from "@/lib/inventory";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireSession();
  const [productCounts, analytics, openCash, businessContext, detections] = await Promise.all([
    getProductCountsForUser(session.user.id),
    getFinancialSummaryForUser(session.user.id, "TODAY"),
    getOpenCashSessionForUser(session.user.id),
    getBusinessForUser(session.user.id),
    getDashboardDetectionsForUser(session.user.id),
  ]);
  if (!analytics) return null;

  const sales = {
    totalCents: analytics.current.salesCents,
    operations: analytics.current.operations,
    ...analytics.payments,
  };
  const firstName = session.user.name.trim().split(/\s+/)[0];
  const methods = [
    { label: "Efectivo", value: sales.cashCents, icon: Banknote },
    { label: "Transferencias", value: sales.transferCents, icon: ReceiptText },
    { label: "Tarjetas", value: sales.cardCents, icon: CreditCard },
  ];
  const aiInsight = buildDeterministicInsights({
    lowStockCount: productCounts.low,
    salesComparisonPercent: analytics.comparisons.sales,
    expensesComparisonPercent: analytics.comparisons.expenses,
  })[0] ?? "Consultá ventas, gastos, margen y stock.";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Resumen de hoy</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Hola, {firstName}</h1>
          <p className="mt-2 text-sm text-muted">Lo importante de tu negocio, en un solo lugar.</p>
        </div>
        <p className="mt-3 text-sm font-bold text-muted sm:mt-0">{sales.operations} {sales.operations === 1 ? "venta registrada" : "ventas registradas"}</p>
      </header>

      <section className="deeta-rule overflow-hidden rounded-2xl border border-line bg-surface" aria-labelledby="ventas-hoy">
        <div className="grid gap-6 px-5 py-6 sm:px-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p id="ventas-hoy" className="text-sm font-bold text-muted">Ventas de hoy</p>
            <p className="mt-2 break-words text-[clamp(2.5rem,9vw,4.6rem)] font-black leading-none tracking-[-0.055em] text-ink">{formatMoney(sales.totalCents)}</p>
          </div>
          <Link href="/vender" className="button-primary min-h-13 px-6">
            <Plus className="size-5" aria-hidden="true" /> Registrar venta
          </Link>
        </div>
        <div className="grid border-t border-line bg-[#f3f2f8] sm:grid-cols-3">
          {methods.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
              <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-muted">{label}</p>
                <p className="truncate text-lg font-black text-ink">{formatMoney(value)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2" aria-label="Resultado y gastos">
        <Link href="/analisis?periodo=TODAY" className="group flex min-w-0 items-center gap-4 bg-surface p-5 transition-colors hover:bg-mint-50">
          <span className="icon-box"><ChartNoAxesCombined className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-muted">Resultado estimado</p><p className={`mt-1 truncate text-2xl font-black ${analytics.current.estimatedResultCents < 0 ? "text-red-700" : ""}`}>{formatMoney(analytics.current.estimatedResultCents)}</p></div>
          <ArrowRight className="size-5 text-muted transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
        <Link href="/gastos" className="group flex min-w-0 items-center gap-4 bg-surface p-5 transition-colors hover:bg-orange-100">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-500"><WalletCards className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-muted">Gastos de hoy</p><p className="mt-1 truncate text-2xl font-black">{formatMoney(analytics.current.expensesCents)}</p></div>
          <ArrowRight className="size-5 text-muted transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.12fr_.88fr]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="section-title">Para atender</h2>
            <Link href="/analisis?periodo=LAST_30_DAYS" className="text-sm font-extrabold text-mint-600 underline decoration-2 underline-offset-4">Ver análisis</Link>
          </div>
          <div className="list-surface">
            <Link href="/caja" className="list-row group">
              <span className={openCash ? "icon-box" : "grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-500"}><CircleDollarSign className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><p className="font-black">Caja {openCash ? "abierta" : "cerrada"}</p><p className="mt-0.5 text-sm text-muted">{openCash ? `Efectivo esperado: ${formatMoney(openCash.expectedCashCents)}` : "Abrila antes de cobrar en efectivo."}</p></div>
              <ArrowRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
            </Link>
            <Link href="/productos?estado=low" className="list-row">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-500"><AlertTriangle className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><p className="font-black">{productCounts.low} {productCounts.low === 1 ? "producto con poco stock" : "productos con poco stock"}</p><p className="mt-0.5 text-sm text-muted">Revisá lo que conviene reponer.</p></div>
              <ArrowRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
            </Link>
            <Link href="/productos" className="list-row">
              <span className="icon-box"><Package className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><p className="font-black">{productCounts.active} productos activos</p><p className="mt-0.5 text-sm text-muted">Consultá precios, costos y stock.</p></div>
              <ArrowRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section>
          <h2 className="section-title mb-3">Lectura rápida</h2>
          <div className="panel deeta-rule h-[calc(100%-2.25rem)]">
            {detections && <><p className="section-label">DEETA detectó</p><p className="mt-2 text-lg font-black">{detections.urgentCount > 0 ? `${detections.urgentCount} ${detections.urgentCount === 1 ? "producto necesita" : "productos necesitan"} atención` : "La reposición está al día"}</p><p className="mt-2 text-sm leading-6 text-muted">{detections.immobilizedValueCents > 0 ? `${formatMoney(detections.immobilizedValueCents)} en mercadería con poco movimiento.` : "No hay stock inmovilizado relevante."}</p></>}
            {businessContext?.role !== "EMPLOYEE" && <div className="mt-5 border-t border-line pt-5"><div className="flex gap-3"><Bot className="mt-0.5 size-5 shrink-0 text-mint-600" aria-hidden="true" /><div><p className="font-black">Una pregunta útil</p><p className="mt-1 text-sm leading-6 text-muted">{aiInsight}</p></div></div><Link href="/deeta-ai" className="button-secondary mt-4 w-full">Preguntarle a DEETA</Link></div>}
          </div>
        </section>
      </div>

      <section>
        <h2 className="section-title mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link href="/gastos/nuevo" className="button-primary"><WalletCards className="size-5" aria-hidden="true" /> Anotar gasto</Link>
          <Link href="/scanner" className="button-secondary"><Camera className="size-5" aria-hidden="true" /> Escanear</Link>
          <Link href="/ventas" className="button-secondary"><ReceiptText className="size-5" aria-hidden="true" /> Ver ventas</Link>
          <Link href="/configuracion/negocio" className="button-secondary"><Settings className="size-5" aria-hidden="true" /> Configuración</Link>
        </div>
      </section>
    </div>
  );
}
