import { ArrowRight, CircleDollarSign, PackageSearch, ReceiptText, Sparkles, TrendingUp, WalletCards } from "lucide-react";

import type { AiBusinessOverviewMetric, AiBusinessOverviewPresentation } from "@/lib/ai/presentation";

const metricAppearance: Record<AiBusinessOverviewMetric["type"], { icon: typeof TrendingUp }> = {
  sales: { icon: TrendingUp },
  "gross-margin": { icon: WalletCards },
  expenses: { icon: ReceiptText },
  "estimated-result": { icon: CircleDollarSign },
  inventory: { icon: PackageSearch },
};

const toneDot: Record<AiBusinessOverviewMetric["tone"], string> = {
  positive: "bg-success",
  attention: "bg-orange-500",
  neutral: "bg-line-strong",
};

function OverviewMetric({ metric }: { metric: AiBusinessOverviewMetric }) {
  const appearance = metricAppearance[metric.type];
  const Icon = appearance.icon;
  return <article className="min-w-0 bg-surface p-4">
    <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-muted">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className={`size-1.5 shrink-0 rounded-full ${toneDot[metric.tone]}`} aria-hidden="true" />
      <h4>{metric.title}</h4>
    </div>
    <p className="mt-3 figure break-words text-2xl">{metric.value}</p>
    {metric.change ? <p className="mt-1.5 text-xs font-extrabold leading-5 text-muted">{metric.change}</p> : null}
    <p className="mt-2 text-sm font-medium leading-6 text-muted">{metric.explanation}</p>
  </article>;
}

export function AiBusinessOverview({ presentation }: { presentation: AiBusinessOverviewPresentation }) {
  return <section className="mt-4 min-w-0 overflow-hidden rounded-xl border border-line bg-surface" aria-label={presentation.title}>
    <div className="px-3 py-3 sm:px-4 sm:py-4">
      <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">Indicadores principales</h3>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
        {presentation.metrics.map((metric) => <OverviewMetric key={metric.type} metric={metric} />)}
      </div>
      {presentation.highlightedProduct ? <article className="mt-3 min-w-0 border-l-2 border-brand pl-4">
        <div className="flex items-center gap-2 text-sm font-black text-ink"><Sparkles className="size-4 shrink-0 text-brand" aria-hidden="true" />{presentation.highlightedProduct.title}</div>
        <p className="mt-1.5 break-words font-display text-lg font-bold text-ink">{presentation.highlightedProduct.productName}</p>
        <p className="mt-2 text-xs font-black text-muted">{presentation.highlightedProduct.valueLabel}</p>
        <p className="figure mt-1 break-words text-xl">{presentation.highlightedProduct.value}</p>
        {presentation.highlightedProduct.secondary ? <p className="mt-2 text-sm font-semibold text-muted">{presentation.highlightedProduct.secondary}</p> : null}
      </article> : null}
      {presentation.recommendations.length > 0 ? <section className="mt-4 border-t border-line pt-4" aria-label="Qué conviene revisar">
        <h3 className="text-sm font-black text-ink">Qué conviene revisar</h3>
        <ul className="mt-2 grid gap-2">
          {presentation.recommendations.map((recommendation) => <li key={recommendation} className="flex min-w-0 items-start gap-2 text-sm font-semibold leading-6 text-ink">
            <ArrowRight className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0 break-words">{recommendation}</span>
          </li>)}
        </ul>
      </section> : null}
    </div>
    <p className="border-t border-line px-4 py-3 text-xs font-semibold text-muted">Período analizado: {presentation.periodLabel}</p>
  </section>;
}
