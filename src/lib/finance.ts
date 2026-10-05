export type FinancialTotals = {
  salesCents: number;
  cogsCents: number;
  expensesCents: number;
  operations: number;
};

export function calculateFinancialResult(values: FinancialTotals) {
  const grossMarginCents = values.salesCents - values.cogsCents;
  return {
    ...values,
    grossMarginCents,
    estimatedResultCents: grossMarginCents - values.expensesCents,
    grossMarginPercent: percentageOf(grossMarginCents, values.salesCents),
    averageTicketCents: values.operations > 0 ? Math.round(values.salesCents / values.operations) : 0,
  };
}

export function percentageOf(part: number, total: number) {
  if (total === 0) return null;
  return Math.round((part * 10_000) / total) / 100;
}

export function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) * 10_000) / Math.abs(previous)) / 100;
}
