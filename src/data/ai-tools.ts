import "server-only";

import { getSqlClient } from "@/db";
import { getFinancialAnalyticsForRangesForUser } from "@/data/analytics";
import { getIntelligentAnalyticsForUser, type IntelligentProduct } from "@/data/intelligent-analytics";
import { getOpenCashSessionForUser } from "@/data/cash";
import type { AiToolDefinition } from "@/lib/ai/types";
import { aiPeriodSchema, productPerformanceSchema, slowMovingSchema } from "@/lib/ai/validation";
import { calculateFinancialResult, percentageOf } from "@/lib/finance";
import { formatMoney } from "@/lib/inventory";
import { resolveAiPeriod, type AiPeriodSelection } from "@/lib/periods";

const periodProperties = {
  kind: { type: "string", enum: ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "CURRENT_MONTH", "PREVIOUS_MONTH", "SPECIFIC_MONTH"] },
  month: { type: ["string", "null"], description: "Mes YYYY-MM solo cuando kind es SPECIFIC_MONTH; null en los demás casos." },
};

export const DEETA_AI_TOOLS: AiToolDefinition[] = [
  { type: "function", name: "get_period_summary", description: "Resumen financiero ya calculado para responder cómo fue un período o compararlo.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_stock_attention", description: "Productos sin stock o por debajo de su mínimo, priorizados con sus ventas recientes.", parameters: { type: "object", properties: {}, required: [], additionalProperties: false }, strict: true },
  { type: "function", name: "get_product_leaders", description: "Distingue el producto más vendido por unidades, el de mayor facturación y el de mayor margen en un período.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_slow_moving_products", description: "Productos activos con stock que tuvieron pocas o ninguna venta durante una cantidad de días.", parameters: { type: "object", properties: { days: { type: "number", minimum: 7, maximum: 90 } }, required: ["days"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_expense_breakdown", description: "Total de gastos y desglose por categoría para un período, con comparación anterior.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_cash_summary", description: "Estado actual de caja y efectivo esperado, ventas y gastos vinculados.", parameters: { type: "object", properties: {}, required: [], additionalProperties: false }, strict: true },
  { type: "function", name: "get_product_performance", description: "Rendimiento de un producto mencionado en la conversación para responder preguntas de seguimiento.", parameters: { type: "object", properties: { productReference: { type: "string", maxLength: 120 }, ...periodProperties }, required: ["productReference", "kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "getSalesTrends", description: "Evolución diaria de ventas, margen bruto, gastos y resultado estimado de un período.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "getStrongestDays", description: "Días de semana con mayor facturación; solo declara un patrón cuando hay datos suficientes.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "getStrongestHours", description: "Franjas de dos horas con más ventas; incluye la suficiencia de datos.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "getInventoryTurnover", description: "Velocidad simple de venta por producto en una ventana reciente, incluyendo días sin ventas.", parameters: { type: "object", properties: { days: { type: "number", enum: [7, 30, 60] } }, required: ["days"], additionalProperties: false }, strict: true },
  { type: "function", name: "getSlowMovingProducts", description: "Productos maduros con stock y una venta o menos en la ventana, sin penalizar productos nuevos.", parameters: { type: "object", properties: { days: { type: "number", enum: [7, 30, 60] } }, required: ["days"], additionalProperties: false }, strict: true },
  { type: "function", name: "getStockCoverage", description: "Días aproximados de stock al ritmo reciente; null cuando no hay ventas suficientes.", parameters: { type: "object", properties: { days: { type: "number", enum: [7, 30, 60] } }, required: ["days"], additionalProperties: false }, strict: true },
  { type: "function", name: "getReorderCandidates", description: "Candidatos explicables para reposición, con prioridad, stock, mínimo y ritmo reciente.", parameters: { type: "object", properties: { days: { type: "number", enum: [7, 30, 60] } }, required: ["days"], additionalProperties: false }, strict: true },
  { type: "function", name: "getAutomaticInsights", description: "Hasta cinco hallazgos determinísticos priorizados, con explicación y evidencia.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "getProductProfitability", description: "Ranking por margen histórico usando el costo guardado en cada venta, y productos de menor margen porcentual.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
];

type AiContext = { businessId: string; timezone: string; today: string };

async function getAiContextForUser(userId: string): Promise<AiContext | null> {
  const sql = getSqlClient();
  const rows = await sql`
    select b.id as business_id, b.timezone, timezone(b.timezone, now())::date::text as today
    from business b inner join business_member bm on bm.business_id = b.id
    where bm.user_id = ${userId} and bm.role in ('OWNER', 'ADMIN') limit 1
  `;
  const row = rows[0];
  return row ? { businessId: String(row.business_id), timezone: String(row.timezone), today: String(row.today) } : null;
}

function periodLabel(selection: AiPeriodSelection, start: string, end: string) {
  const labels: Record<AiPeriodSelection["kind"], string> = {
    TODAY: "hoy", YESTERDAY: "ayer", LAST_7_DAYS: "últimos 7 días", LAST_30_DAYS: "últimos 30 días",
    CURRENT_MONTH: "este mes", PREVIOUS_MONTH: "mes pasado", SPECIFIC_MONTH: selection.month ?? "mes solicitado",
  };
  return { label: labels[selection.kind], start, end };
}

async function resolveToolPeriod(userId: string, rawArguments: unknown) {
  const selection = aiPeriodSchema.parse(rawArguments);
  const context = await getAiContextForUser(userId);
  if (!context) throw new Error("AI_FORBIDDEN");
  const ranges = resolveAiPeriod(context.today, selection);
  return { selection, context, ranges };
}

function productView(product: { name: string; units: number; salesCents: number; grossMarginCents: number }) {
  return { name: product.name, units: product.units, salesCents: product.salesCents, sales: formatMoney(product.salesCents), grossMarginCents: product.grossMarginCents, grossMargin: formatMoney(product.grossMarginCents) };
}

async function getPeriodSummary(userId: string, rawArguments: unknown) {
  const { selection, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getFinancialAnalyticsForRangesForUser(userId, ranges);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  return {
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    salesCents: analytics.current.salesCents, sales: formatMoney(analytics.current.salesCents), operations: analytics.current.operations,
    costOfGoodsSoldCents: analytics.current.cogsCents, costOfGoodsSold: formatMoney(analytics.current.cogsCents), grossMarginCents: analytics.current.grossMarginCents, grossMargin: formatMoney(analytics.current.grossMarginCents),
    expensesCents: analytics.current.expensesCents, expenses: formatMoney(analytics.current.expensesCents), estimatedResultCents: analytics.current.estimatedResultCents, estimatedResult: formatMoney(analytics.current.estimatedResultCents),
    averageTicket: formatMoney(analytics.current.averageTicketCents), grossMarginPercent: analytics.current.grossMarginPercent,
    comparisonsPercent: analytics.comparisons,
    comparisonPeriod: analytics.ranges.previous,
    dataSufficiency: { hasSales: analytics.current.operations > 0, previousHasSales: analytics.previous.operations > 0 },
    highlightedProducts: analytics.products.slice(0, 3).map(productView),
  };
}

async function getStockAttention(userId: string) {
  const sql = getSqlClient();
  const rows = await sql`
    with context as (
      select b.id as business_id, b.timezone, timezone(b.timezone, now())::date as today
      from business b inner join business_member bm on bm.business_id = b.id
      where bm.user_id = ${userId} and bm.role in ('OWNER', 'ADMIN') limit 1
    ), recent_sales as (
      select si.product_id, sum(si.quantity)::int as units
      from sale_item si inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
      inner join context c on c.business_id = s.business_id
      where s.status = 'COMPLETED' and timezone(c.timezone, s.created_at)::date between c.today - 29 and c.today
      group by si.product_id
    )
    select p.name, p.current_stock, p.minimum_stock, coalesce(rs.units, 0)::int as recent_units
    from product p inner join context c on c.business_id = p.business_id
    left join recent_sales rs on rs.product_id = p.id
    where p.is_active = true and (p.current_stock = 0 or (p.minimum_stock > 0 and p.current_stock <= p.minimum_stock))
    order by (p.current_stock = 0) desc, coalesce(rs.units, 0) desc, p.current_stock asc, p.name asc limit 30
  `;
  return {
    count: rows.length,
    products: rows.map((row) => ({ name: String(row.name), currentStock: Number(row.current_stock), minimumStock: Number(row.minimum_stock), unitsSoldLast30Days: Number(row.recent_units) })),
  };
}

async function getProductLeaders(userId: string, rawArguments: unknown) {
  const { selection, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getFinancialAnalyticsForRangesForUser(userId, ranges);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  return {
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    hasSales: analytics.current.operations > 0,
    mostSoldByUnits: analytics.mostSold ? productView(analytics.mostSold) : null,
    highestRevenue: analytics.mostRevenue ? productView(analytics.mostRevenue) : null,
    highestGrossMargin: analytics.mostProfitable ? productView(analytics.mostProfitable) : null,
  };
}

async function getSlowMovingProducts(userId: string, rawArguments: unknown) {
  const { days } = slowMovingSchema.parse(rawArguments);
  const sql = getSqlClient();
  const rows = await sql`
    with context as (
      select b.id as business_id, b.timezone, timezone(b.timezone, now())::date as today
      from business b inner join business_member bm on bm.business_id = b.id
      where bm.user_id = ${userId} and bm.role in ('OWNER', 'ADMIN') limit 1
    )
    select p.name, p.current_stock,
      coalesce(sum(si.quantity) filter (where timezone(c.timezone, s.created_at)::date between c.today - (${days}::int - 1) and c.today and s.status = 'COMPLETED'), 0)::int as units,
      max(timezone(c.timezone, s.created_at)::date) filter (where s.status = 'COMPLETED')::text as last_sale
    from product p inner join context c on c.business_id = p.business_id
    left join sale_item si on si.product_id = p.id and si.business_id = p.business_id
    left join sale s on s.id = si.sale_id and s.business_id = si.business_id
    where p.is_active = true and p.current_stock > 0
    group by p.id
    having coalesce(sum(si.quantity) filter (where timezone(c.timezone, s.created_at)::date between c.today - (${days}::int - 1) and c.today and s.status = 'COMPLETED'), 0) <= 1
    order by units asc, p.current_stock desc, p.name asc limit 20
  `;
  return { days, sufficientData: rows.some((row) => row.last_sale !== null), products: rows.map((row) => ({ name: String(row.name), currentStock: Number(row.current_stock), unitsSold: Number(row.units), lastSale: row.last_sale ? String(row.last_sale) : null })) };
}

async function getExpenseBreakdown(userId: string, rawArguments: unknown) {
  const { selection, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getFinancialAnalyticsForRangesForUser(userId, ranges);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  return {
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    total: formatMoney(analytics.current.expensesCents),
    comparisonPercent: analytics.comparisons.expenses,
    previousTotal: formatMoney(analytics.previous.expensesCents),
    categories: analytics.expensesByCategory.map((category) => ({ name: category.name, amount: formatMoney(category.amountCents) })),
  };
}

async function getCashSummary(userId: string) {
  const cash = await getOpenCashSessionForUser(userId);
  return cash ? {
    status: "OPEN", openedAt: cash.openedAt.toISOString(), openingAmount: formatMoney(cash.openingAmountCents),
    expectedCash: formatMoney(cash.expectedCashCents), cashSales: formatMoney(cash.cashSalesCents),
    cashExpenses: formatMoney(cash.cashExpensesCents), operations: cash.cashOperations,
  } : { status: "CLOSED" };
}

async function getProductPerformance(userId: string, rawArguments: unknown) {
  const raw = rawArguments as Record<string, unknown>;
  const { productReference } = productPerformanceSchema.parse({ productReference: raw?.productReference });
  const { selection, context, ranges } = await resolveToolPeriod(userId, { kind: raw?.kind, month: raw?.month });
  const sql = getSqlClient();
  const rows = await sql`
    select p.name, p.current_stock, p.minimum_stock,
      coalesce(sum(si.quantity) filter (where s.id is not null), 0)::int as units,
      coalesce(sum(si.unit_price_cents * si.quantity) filter (where s.id is not null), 0)::bigint as sales_cents,
      coalesce(sum(si.unit_cost_cents * si.quantity) filter (where s.id is not null), 0)::bigint as cogs_cents,
      max(timezone(${context.timezone}, s.created_at)::date)::text as last_sale
    from product p
    left join sale_item si on si.product_id = p.id and si.business_id = p.business_id
    left join sale s on s.id = si.sale_id and s.business_id = si.business_id and s.status = 'COMPLETED'
      and timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
    where p.business_id = ${context.businessId} and p.is_active = true and p.name ilike ${`%${productReference}%`}
    group by p.id
    order by (lower(p.name) = lower(${productReference})) desc, units desc limit 3
  `;
  return {
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    matches: rows.map((row) => {
      const salesCents = Number(row.sales_cents); const cogsCents = Number(row.cogs_cents);
      const totals = calculateFinancialResult({ salesCents, cogsCents, expensesCents: 0, operations: 0 });
      return { name: String(row.name), currentStock: Number(row.current_stock), minimumStock: Number(row.minimum_stock), units: Number(row.units), sales: formatMoney(salesCents), grossMargin: formatMoney(totals.grossMarginCents), marginPercent: percentageOf(totals.grossMarginCents, salesCents), lastSale: row.last_sale ? String(row.last_sale) : null };
    }),
  };
}

async function getIntelligentPeriod(userId: string, rawArguments: unknown) {
  const { selection, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getIntelligentAnalyticsForUser(userId, ranges);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  return { analytics, period: periodLabel(selection, ranges.current.start, ranges.current.end) };
}

function inventoryDays(rawArguments: unknown) {
  const days = Number((rawArguments as { days?: unknown })?.days);
  if (![7, 30, 60].includes(days)) throw new Error("INVALID_INVENTORY_WINDOW");
  return days;
}

async function getInventoryAnalytics(userId: string, rawArguments: unknown) {
  const days = inventoryDays(rawArguments);
  const context = await getAiContextForUser(userId);
  if (!context) throw new Error("AI_FORBIDDEN");
  const ranges = resolveAiPeriod(context.today, { kind: days === 7 ? "LAST_7_DAYS" : "LAST_30_DAYS", month: null });
  if (days === 60) {
    const end = new Date(`${context.today}T00:00:00.000Z`);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 59);
    const previousEnd = new Date(start); previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
    const previousStart = new Date(previousEnd); previousStart.setUTCDate(previousStart.getUTCDate() - 59);
    ranges.current = { start: start.toISOString().slice(0, 10), end: context.today };
    ranges.previous = { start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10) };
  }
  const analytics = await getIntelligentAnalyticsForUser(userId, ranges, days);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  return { days, analytics };
}

function inventoryProductView(product: IntelligentProduct) {
  return {
    name: product.name, currentStock: product.currentStock, minimumStock: product.minimumStock,
    unitsSold: product.unitsInVelocityWindow, averageDailySales: product.averageDailySales,
    estimatedDaysRemaining: product.estimatedDaysRemaining, priority: product.reorderPriority,
    confidence: product.confidence, lastSale: product.lastSale,
  };
}

export function createAiToolExecutor(userId: string) {
  return async (name: string, rawArguments: unknown) => {
    if (name === "get_period_summary") return getPeriodSummary(userId, rawArguments);
    if (name === "get_stock_attention") return getStockAttention(userId);
    if (name === "get_product_leaders") return getProductLeaders(userId, rawArguments);
    if (name === "get_slow_moving_products") return getSlowMovingProducts(userId, rawArguments);
    if (name === "get_expense_breakdown") return getExpenseBreakdown(userId, rawArguments);
    if (name === "get_cash_summary") return getCashSummary(userId);
    if (name === "get_product_performance") return getProductPerformance(userId, rawArguments);
    if (name === "getSalesTrends") {
      const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
      return { period, comparisonsPercent: analytics.financial.comparisons, daily: analytics.evolution };
    }
    if (name === "getStrongestDays") {
      const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
      return { period, sufficientData: analytics.patterns.sufficient, reason: analytics.patterns.reason, strongest: analytics.patterns.strongestDay, days: analytics.patterns.weekdays };
    }
    if (name === "getStrongestHours") {
      const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
      return { period, sufficientData: analytics.patterns.sufficient, reason: analytics.patterns.reason, strongest: analytics.patterns.strongestHour, weakest: analytics.patterns.weakestHour, bands: analytics.patterns.hours };
    }
    if (name === "getInventoryTurnover") {
      const { days, analytics } = await getInventoryAnalytics(userId, rawArguments);
      return { days, methodology: `unidades vendidas / ${days} días calendario`, products: analytics.inventory.products.map(inventoryProductView) };
    }
    if (name === "getSlowMovingProducts") {
      const { days, analytics } = await getInventoryAnalytics(userId, rawArguments);
      return { days, newProductThresholdDays: 14, products: analytics.rankings.slowMoving.map(inventoryProductView) };
    }
    if (name === "getStockCoverage") {
      const { days, analytics } = await getInventoryAnalytics(userId, rawArguments);
      return { days, methodology: "stock actual / promedio diario; null cuando el promedio es cero", products: analytics.inventory.products.map(inventoryProductView) };
    }
    if (name === "getReorderCandidates") {
      const { days, analytics } = await getInventoryAnalytics(userId, rawArguments);
      return { days, rules: { urgent: "sin stock, en/bajo mínimo o hasta 3 días", soon: "hasta 7 días o cerca del mínimo" }, products: analytics.inventory.reorderCandidates.map(inventoryProductView) };
    }
    if (name === "getAutomaticInsights") {
      const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
      return { period, insights: analytics.insights };
    }
    if (name === "getProductProfitability") {
      const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
      const view = (product: (typeof analytics.products)[number]) => ({ name: product.name, units: product.units, revenue: formatMoney(product.salesCents), cogs: formatMoney(product.cogsCents), grossMargin: formatMoney(product.grossMarginCents), marginPercent: product.marginPercent });
      return { period, methodology: "costos históricos guardados en cada ítem de venta", mostProfitable: analytics.rankings.byProfitability.map(view), lowestMargin: analytics.rankings.lowestMargin.map(view) };
    }
    throw new Error("AI_TOOL_NOT_ALLOWED");
  };
}
