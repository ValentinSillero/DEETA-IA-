import { ArrowRight, CircleAlert, CircleCheck, Sparkles, Store } from "lucide-react";

import { AiResult } from "@/components/ai/ai-result";
import type { AiBusinessOverviewMetric, AiBusinessOverviewPresentation } from "@/lib/ai/presentation";

// El tono se muestra con ícono además de color.
function ToneIcon({ tone }: { tone: AiBusinessOverviewMetric["tone"] }) {
  if (tone === "positive") return <CircleCheck className="size-3.5 shrink-0 text-success" aria-label="Bien" />;
  if (tone === "attention") return <CircleAlert className="size-3.5 shrink-0 text-[#a8530f]" aria-label="Para revisar" />;
  return null;
}

function OverviewMetric({ metric }: { metric: AiBusinessOverviewMetric }) {
  return <div className="border-b border-line py-2.5 first:pt-0 last:border-b-0">
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-muted"><span className="min-w-0 break-words">{metric.title}</span><ToneIcon tone={metric.tone} /></p>
      <p className="figure shrink-0 text-lg">{metric.value}</p>
    </div>
    {metric.change ? <p className="text-xs font-semibold text-muted">{metric.change}</p> : null}
    <p className="mt-0.5 text-sm leading-5 text-muted">{metric.explanation}</p>
  </div>;
}

export function AiBusinessOverview({ presentation }: { presentation: AiBusinessOverviewPresentation }) {
  return <AiResult title={presentation.title} icon={Store} meta={`Período analizado: ${presentation.periodLabel}`}>
    <div className="min-w-0">
      {presentation.metrics.map((metric) => <OverviewMetric key={metric.type} metric={metric} />)}
    </div>
    {presentation.highlightedProduct ? <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden="true" />{presentation.highlightedProduct.title}</p>
      <div className="mt-1 flex min-w-0 items-baseline justify-between gap-3">
        <p className="min-w-0 break-words font-semibold text-ink">{presentation.highlightedProduct.productName}</p>
        <p className="shrink-0 text-right"><span className="figure block">{presentation.highlightedProduct.value}</span><span className="text-xs text-muted">{presentation.highlightedProduct.valueLabel}</span></p>
      </div>
      {presentation.highlightedProduct.secondary ? <p className="mt-0.5 text-xs text-muted">{presentation.highlightedProduct.secondary}</p> : null}
    </div> : null}
    {presentation.recommendations.length > 0 ? <div className="mt-3">
      <p className="text-sm font-semibold text-ink">Qué conviene revisar</p>
      <ul className="mt-1 grid gap-1.5">
        {presentation.recommendations.map((recommendation) => <li key={recommendation} className="flex min-w-0 items-start gap-2 text-sm leading-6 text-ink">
          <ArrowRight className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0 break-words">{recommendation}</span>
        </li>)}
      </ul>
    </div> : null}
  </AiResult>;
}
