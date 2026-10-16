import {
  ArrowRight,
  Bot,
  Camera,
  CircleDollarSign,
  Package,
  ReceiptText,
  Settings,
  TriangleAlert,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { GettingStarted } from "@/components/onboarding/getting-started";
import { getFinancialSummaryForUser } from "@/data/analytics";
import { getBusinessForUser } from "@/data/businesses";
import { getOpenCashSessionForUser } from "@/data/cash";
import { getCustomerDebtSummaryForUser } from "@/data/customers";
import { getDashboardDetectionsForUser } from "@/data/intelligent-analytics";
import { getOnboardingPlanForUser } from "@/data/onboarding";
import { getProductCountsForUser } from "@/data/products";
import { buildDeterministicInsights } from "@/lib/ai/insights";
import { formatMoney } from "@/lib/inventory";
import { requireSession } from "@/lib/session";

type Tone = "ok" | "warn" | "neutral";
const toneDot: Record<Tone, string> = { ok: "bg-success", warn: "bg-orange-500", neutral: "bg-line-strong" };

function AttentionRow({ href, icon: Icon, title, detail, tone, status }: { href: Route; icon: LucideIcon; title: string; detail: string; tone: Tone; status: string }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-3.5 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2 sm:px-5">
      <Icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{title}</p>
        <p className="truncate text-sm text-muted">{detail}</p>
      </div>
      <span className="hidden items-center gap-1.5 text-xs font-semibold text-muted min-[400px]:inline-flex">
        <span className={`size-2 rounded-full ${toneDot[tone]}`} aria-hidden="true" />{status}
      </span>
      <ArrowRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const [productCounts, analytics, openCash, businessContext, detections, onboarding, debts] = await Promise.all([
    getProductCountsForUser(session.user.id),
    getFinancialSummaryForUser(session.user.id, "TODAY"),
    getOpenCashSessionForUser(session.user.id),
    getBusinessForUser(session.user.id),
    getDashboardDetectionsForUser(session.user.id),
    getOnboardingPlanForUser(session.user.id),
    getCustomerDebtSummaryForUser(session.user.id),
  ]);
  if (!analytics) return null;
  const hasSales = onboarding?.state.signals.hasSales ?? true;
  const hasProducts = onboarding?.state.signals.hasProducts ?? true;
  const canUseAi = businessContext?.role !== "EMPLOYEE";

  const today = analytics.current;
  const payments = analytics.payments;
  const firstName = session.user.name.trim().split(/\s+/)[0];
  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: businessContext?.business.timezone ?? "America/Argentina/Buenos_Aires",
  }).format(new Date());
  const aiInsight = buildDeterministicInsights({
    lowStockCount: productCounts.low,
    salesComparisonPercent: analytics.comparisons.sales,
    expensesComparisonPercent: analytics.comparisons.expenses,
  })[0] ?? "Consultá ventas, gastos, margen y stock.";
  const urgent = hasProducts && detections ? detections.urgentCount : 0;

  return (
    <div className="grid gap-6 sm:gap-7">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted first-letter:uppercase">{dateLabel}</p>
          <h1 className="page-title mt-1">Hola, {firstName}</h1>
        </div>
      </header>

      {onboarding && <GettingStarted plan={onboarding.plan} />}

      {/* Hoy: lo vendido y el resultado, como una hoja de caja del día. */}
      <section aria-labelledby="hoy-titulo" className="overflow-hidden rounded-2xl border border-line bg-surface">
        <h2 id="hoy-titulo" className="sr-only">Hoy</h2>
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-muted">Ventas de hoy</p>
              <p className="text-sm text-muted">{today.operations} {today.operations === 1 ? "venta" : "ventas"}</p>
            </div>
            <p className="figure mt-1 break-words text-[clamp(2.4rem,8vw,3.6rem)] leading-none">{formatMoney(today.salesCents)}</p>
            <div className="ledger mt-4">
              <div className="ledger-row"><span>Efectivo</span><span className="ledger-fill" aria-hidden="true" /><span>{formatMoney(payments.cashCents)}</span></div>
              <div className="ledger-row"><span>Transferencias</span><span className="ledger-fill" aria-hidden="true" /><span>{formatMoney(payments.transferCents)}</span></div>
              <div className="ledger-row"><span>Tarjetas</span><span className="ledger-fill" aria-hidden="true" /><span>{formatMoney(payments.cardCents)}</span></div>
              {payments.creditCents > 0 && <div className="ledger-row"><span>Fiado (no entra a caja)</span><span className="ledger-fill" aria-hidden="true" /><span>{formatMoney(payments.creditCents)}</span></div>}
            </div>
          </div>
          <div className="border-t border-line bg-surface-2/60 px-5 py-5 sm:px-6 sm:py-6 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold text-muted">Resultado del día</p>
            <div className="ledger mt-3">
              <div className="ledger-row"><span>Margen de lo vendido</span><span className="ledger-fill" aria-hidden="true" /><span>{formatMoney(today.grossMarginCents)}</span></div>
              <div className="ledger-row"><Link href="/gastos" className="underline decoration-line-strong underline-offset-4 hover:text-ink">Gastos</Link><span className="ledger-fill" aria-hidden="true" /><span>−{formatMoney(today.expensesCents)}</span></div>
              <div className="ledger-total">
                <span className="font-semibold">Resultado estimado</span>
                <span className={`figure text-2xl ${today.estimatedResultCents < 0 ? "text-red-700" : ""}`}>{formatMoney(today.estimatedResultCents)}</span>
              </div>
            </div>
            <Link href="/analisis?periodo=TODAY" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">Ver análisis del día <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="atender-titulo">
          <h2 id="atender-titulo" className="section-title mb-3">Para atender</h2>
          <div className="list-surface">
            <AttentionRow href="/caja" icon={CircleDollarSign} title={openCash ? "Caja abierta" : "Caja cerrada"} detail={openCash ? `Efectivo esperado: ${formatMoney(openCash.expectedCashCents)}` : "Abrila antes de cobrar en efectivo."} tone={openCash ? "ok" : "warn"} status={openCash ? "En curso" : "Pendiente"} />
            {debts.pendingCents > 0 && <AttentionRow href="/clientes?estado=debt" icon={UsersRound} title={`Te deben ${formatMoney(debts.pendingCents)}`} detail={`${debts.debtors} ${debts.debtors === 1 ? "cliente con deuda" : "clientes con deuda"}.`} tone="warn" status="Fiado" />}
            {hasProducts ? (
              <AttentionRow href="/productos?estado=low" icon={TriangleAlert} title={productCounts.low === 0 ? "Stock sin alertas" : `${productCounts.low} ${productCounts.low === 1 ? "producto con poco stock" : "productos con poco stock"}`} detail={urgent > 0 ? `${urgent} ${urgent === 1 ? "necesita" : "necesitan"} reposición pronto.` : "Revisá lo que conviene reponer."} tone={productCounts.low > 0 || urgent > 0 ? "warn" : "ok"} status={productCounts.low > 0 || urgent > 0 ? "Revisar" : "Al día"} />
            ) : (
              <AttentionRow href="/productos" icon={Package} title="Sin productos cargados" detail="Cargá tu mercadería para vender y controlar stock." tone="warn" status="Pendiente" />
            )}
            <AttentionRow href="/productos" icon={Package} title={`${productCounts.active} ${productCounts.active === 1 ? "producto activo" : "productos activos"}`} detail={detections && detections.immobilizedValueCents > 0 ? `${formatMoney(detections.immobilizedValueCents)} en mercadería con poco movimiento.` : "Precios, costos y stock."} tone="neutral" status="Catálogo" />
          </div>
        </section>

        <section aria-labelledby="atajos-titulo" className="grid gap-6">
          {canUseAi && (
            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold">{hasSales ? "DEETA te sugiere" : "DEETA AI"}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{hasSales ? aiInsight : "Cuando registres tus primeras ventas, DEETA AI va a poder ayudarte a analizar tu negocio."}</p>
                  {hasSales && <Link href="/deeta-ai" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline decoration-line-strong underline-offset-4 hover:decoration-ink">Preguntarle a DEETA <ArrowRight className="size-4" aria-hidden="true" /></Link>}
                </div>
              </div>
            </div>
          )}
          <div>
            <h2 id="atajos-titulo" className="section-title mb-3">Atajos</h2>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
              {([
                { href: "/gastos/nuevo", label: "Anotar gasto", icon: WalletCards },
                { href: "/scanner", label: "Escanear", icon: Camera },
                { href: "/ventas", label: "Ver ventas", icon: ReceiptText },
                { href: "/configuracion/negocio", label: "Mi negocio", icon: Settings },
              ] as const).map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex min-h-13 items-center gap-2.5 bg-surface px-4 text-sm font-semibold transition-colors hover:bg-surface-2">
                  <Icon className="size-[18px] shrink-0 text-muted" aria-hidden="true" />{label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
