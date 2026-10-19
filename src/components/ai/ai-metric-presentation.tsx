import { ChartNoAxesCombined, ReceiptText } from "lucide-react";

import { AiLedgerRow, AiResult } from "@/components/ai/ai-result";
import type { AiExpenseBreakdownPresentation, AiMetricPresentation } from "@/lib/ai/presentation";

export function AiMetricCard({ presentation }: { presentation: AiMetricPresentation }) {
  return <AiResult title={presentation.title} icon={ChartNoAxesCombined} meta={presentation.periodLabel}>
    <p className="figure break-words text-[1.75rem] leading-tight">{presentation.value}</p>
    {presentation.comparison ? <p className="mt-1 text-sm font-semibold text-muted">{presentation.comparison}</p> : null}
    <p className="mt-2 text-[0.95rem] leading-6 text-ink">{presentation.explanation}</p>
    {presentation.details.length > 0 ? <div className="ledger mt-2 text-sm">
      {presentation.details.map((detail) => <AiLedgerRow key={detail.label} label={detail.label} value={detail.value} />)}
    </div> : null}
  </AiResult>;
}

function percentageLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (value === 0) return "sin cambios";
  return `${Math.abs(value).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% ${value > 0 ? "más" : "menos"}`;
}

export function AiExpenseBreakdown({ presentation }: { presentation: AiExpenseBreakdownPresentation }) {
  return <AiResult title={presentation.title} icon={ReceiptText} meta={presentation.periodLabel}>
    <p className="figure break-words text-[1.75rem] leading-tight">{presentation.total}</p>
    <p className="text-sm text-muted">Gastos totales{presentation.comparison ? ` · ${presentation.comparison}` : ""}</p>
    {presentation.categories.length > 0 ? <div className="ledger mt-2 text-sm">
      {presentation.categories.map((category) => {
        const percentage = percentageLabel(category.percentageDifference);
        return <AiLedgerRow
          key={category.name}
          label={category.name}
          value={category.amount}
          note={`Antes ${category.previousAmount} · diferencia ${category.difference}${percentage ? ` (${percentage})` : ""}`}
        />;
      })}
    </div> : <p className="mt-2 text-sm text-muted">No hay gastos registrados en este período.</p>}
  </AiResult>;
}
