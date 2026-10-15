import { ArrowRight, ChartNoAxesCombined, ReceiptText } from "lucide-react";

import type { AiExpenseBreakdownPresentation, AiMetricPresentation } from "@/lib/ai/presentation";

export function AiMetricCard({ presentation }: { presentation: AiMetricPresentation }) {
  return <section className="mt-4 min-w-0 overflow-hidden rounded-xl border border-line bg-surface" aria-label={presentation.title}>
    <header className="border-b border-line px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 text-sm font-black text-ink">
        <ChartNoAxesCombined className="size-4 shrink-0 text-brand" aria-hidden="true" />
        <h3>{presentation.title}</h3>
      </div>
      {presentation.periodLabel ? <p className="mt-0.5 text-xs font-semibold text-muted">{presentation.periodLabel}</p> : null}
    </header>
    <div className="px-4 py-4 sm:px-5">
      <p className="figure break-words text-2xl">{presentation.value}</p>
      {presentation.comparison ? <p className="mt-1.5 text-sm font-extrabold leading-6 text-muted">{presentation.comparison}</p> : null}
      <p className="mt-2 text-sm font-medium leading-6 text-muted">{presentation.explanation}</p>
      {presentation.details.length > 0 ? <dl className="mt-4 grid min-w-0 gap-3 border-t border-line pt-4 min-[390px]:grid-cols-2">
        {presentation.details.map((detail) => <div key={detail.label} className="min-w-0">
          <dt className="text-[0.7rem] font-black text-muted">{detail.label}</dt>
          <dd className="mt-1 break-words text-sm font-extrabold text-ink">{detail.value}</dd>
        </div>)}
      </dl> : null}
    </div>
  </section>;
}

function percentageLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (value === 0) return "Sin cambios";
  return `${Math.abs(value).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% ${value > 0 ? "más" : "menos"}`;
}

export function AiExpenseBreakdown({ presentation }: { presentation: AiExpenseBreakdownPresentation }) {
  return <section className="mt-4 min-w-0 overflow-hidden rounded-xl border border-line bg-surface" aria-label={presentation.title}>
    <header className="border-b border-line px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 text-sm font-black text-ink">
        <ReceiptText className="size-4 shrink-0 text-brand" aria-hidden="true" />
        <h3>{presentation.title}</h3>
      </div>
      <p className="mt-0.5 text-xs font-semibold text-muted">{presentation.periodLabel}</p>
    </header>
    <div className="px-4 py-4 sm:px-5">
      <p className="text-[0.7rem] font-black text-muted">Gastos totales</p>
      <p className="mt-1 figure break-words text-2xl">{presentation.total}</p>
      {presentation.comparison ? <p className="mt-1.5 text-sm font-extrabold leading-6 text-muted">{presentation.comparison}</p> : null}
    </div>
    {presentation.categories.length > 0 ? <ul className="divide-y divide-line border-t border-line">
      {presentation.categories.map((category) => <li key={category.name} className="min-w-0 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h4 className="min-w-0 break-words text-sm font-black text-ink">{category.name}</h4>
          <p className="shrink-0 text-sm font-black text-ink">{category.amount}</p>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted">
          <span>Anterior: {category.previousAmount}</span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Diferencia: {category.difference}</span>
          {percentageLabel(category.percentageDifference) ? <span>({percentageLabel(category.percentageDifference)})</span> : null}
        </div>
      </li>)}
    </ul> : <p className="border-t border-line px-4 py-4 text-sm font-semibold text-muted sm:px-5">No hay gastos registrados en este período.</p>}
  </section>;
}
