export const VELOCITY_WINDOW_DAYS = 30;
export const IMMOBILIZED_WINDOW_DAYS = 60;
export const NEW_PRODUCT_DAYS = 14;

export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type ReorderPriority = "URGENT" | "SOON" | "OK";
export type InsightSeverity = "HIGH" | "MEDIUM" | "LOW";
export type InsightType =
  | "LOW_STOCK"
  | "SLOW_MOVING"
  | "HIGH_MARGIN"
  | "LOW_MARGIN"
  | "SALES_GROWING"
  | "SALES_FALLING"
  | "EXPENSES_GROWING"
  | "HIGH_STOCK_LOW_ROTATION"
  | "REORDER_SOON";

export type AutomaticInsight = {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  explanation: string;
  evidence: Array<{ label: string; value: string }>;
  calculatedAt: string;
};

export function calendarDays(start: string, end: string) {
  const from = Date.parse(`${start}T00:00:00.000Z`);
  const to = Date.parse(`${end}T00:00:00.000Z`);
  return Math.max(1, Math.floor((to - from) / 86_400_000) + 1);
}

export function averageDailySales(units: number, days: number) {
  return days > 0 ? units / days : 0;
}

export function estimatedStockDays(currentStock: number, dailyAverage: number) {
  return dailyAverage > 0 ? currentStock / dailyAverage : null;
}

export function confidenceForHistory(historyDays: number): Confidence {
  if (historyDays >= 90) return "HIGH";
  if (historyDays >= 14) return "MEDIUM";
  return "LOW";
}

export function classifyReorder(values: {
  currentStock: number;
  minimumStock: number;
  estimatedDaysRemaining: number | null;
}): ReorderPriority {
  if (
    values.currentStock === 0
    || (values.minimumStock > 0 && values.currentStock <= values.minimumStock)
    || (values.estimatedDaysRemaining !== null && values.estimatedDaysRemaining <= 3)
  ) return "URGENT";
  if (
    (values.estimatedDaysRemaining !== null && values.estimatedDaysRemaining <= 7)
    || (values.minimumStock > 0 && values.currentStock <= Math.ceil(values.minimumStock * 1.5))
  ) return "SOON";
  return "OK";
}

export function isSlowMoving(values: { productAgeDays: number; unitsSold: number; currentStock: number }) {
  return values.productAgeDays >= NEW_PRODUCT_DAYS && values.currentStock > 0 && values.unitsSold <= 1;
}

export function isImmobilized(values: { productAgeDays: number; unitsSoldLast60Days: number; currentStock: number }) {
  return values.productAgeDays >= NEW_PRODUCT_DAYS
    && values.currentStock > 0
    && values.unitsSoldLast60Days <= 1;
}

export function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

export function rankInsights(insights: AutomaticInsight[]) {
  const severity = { HIGH: 0, MEDIUM: 1, LOW: 2 } satisfies Record<InsightSeverity, number>;
  return [...insights].sort((a, b) => severity[a.severity] - severity[b.severity]).slice(0, 5);
}
