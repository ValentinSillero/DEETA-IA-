import "server-only";

import { z } from "zod";

import { getSqlClient } from "@/db";
import { getFinancialAnalyticsForRangesForUser } from "@/data/analytics";
import { getIntelligentAnalyticsForUser, type IntelligentProduct } from "@/data/intelligent-analytics";
import { getCashSessionsForUser, getOpenCashSessionForUser } from "@/data/cash";
import type { AiToolDefinition } from "@/lib/ai/types";
import { aiPeriodSchema, inventoryAnalysisSchema, productPerformanceSchema, productSalesRankingSchema, salesPatternsSchema, slowMovingSchema } from "@/lib/ai/validation";
import { calculateFinancialResult, percentageChange, percentageOf } from "@/lib/finance";
import { formatMoney } from "@/lib/inventory";
import { resolveAiPeriod, type AiPeriodSelection } from "@/lib/periods";

const periodProperties = {
  kind: { type: "string", enum: ["TODAY", "YESTERDAY", "CURRENT_WEEK", "PREVIOUS_WEEK", "LAST_7_DAYS", "LAST_30_DAYS", "CURRENT_MONTH", "PREVIOUS_MONTH", "CURRENT_YEAR", "SPECIFIC_MONTH", "CUSTOM_RANGE"] },
  month: { type: ["string", "null"], description: "Mes YYYY-MM solo cuando kind es SPECIFIC_MONTH; null en los demás casos." },
  start: { type: ["string", "null"], description: "Fecha inicial YYYY-MM-DD solo cuando kind es CUSTOM_RANGE." },
  end: { type: ["string", "null"], description: "Fecha final YYYY-MM-DD solo cuando kind es CUSTOM_RANGE." },
};

export const DEETA_AI_TOOLS: AiToolDefinition[] = [
  { type: "function", name: "get_period_summary", description: "Ventas, cantidad de operaciones, ticket promedio, margen, gastos, resultado y comparación completa del período.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_business_period_analysis", description: "Análisis general agregado del negocio: finanzas, productos, inventario y patrones del período en una sola consulta lógica.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_top_product_analysis", description: "Producto más vendido por unidades y su desempeño actual y anterior.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_product_sales_ranking", description: "Ranking determinístico de productos por unidades o facturación, incluyendo productos sin ventas. Distingue menor venta de baja rotación.", parameters: { type: "object", properties: { ...periodProperties, ranking: { type: "string", enum: ["MOST_UNITS", "LEAST_UNITS", "MOST_REVENUE", "LEAST_REVENUE", "NO_SALES"] }, limit: { type: "number", enum: [1, 5, 8] } }, required: ["kind", "month", "ranking", "limit"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_inventory_analysis", description: "Stock actual, faltantes, productos bajo mínimo, reposición, baja rotación o exceso. Devuelve productos y cifras, no solo conteos.", parameters: { type: "object", properties: { focus: { type: "string", enum: ["REORDER", "SLOW", "EXCESS", "LOW_STOCK", "LOWEST_STOCK", "OUT_OF_STOCK", "BELOW_MINIMUM"] }, days: { type: "number", enum: [7, 30, 60] } }, required: ["focus", "days"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_expense_breakdown", description: "Gastos por categoría y comparación anterior.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_customer_balances", description: "Solo lectura. Saldos de clientes con fiado: cuánto le deben al negocio, quién debe más o quién hace más tiempo que no paga.", parameters: { type: "object", properties: { focus: { type: "string", enum: ["DEBTORS", "TOP_DEBTOR", "OLDEST_UNPAID"] } }, required: ["focus"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_customer_account", description: "Solo lectura. Saldo, último pago y compras fiadas pendientes de un cliente mencionado por nombre.", parameters: { type: "object", properties: { customerReference: { type: "string", maxLength: 120 } }, required: ["customerReference"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_customer_payments", description: "Solo lectura. Pagos de fiado recibidos de clientes en el período, por medio de pago.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_cash_summary", description: "Estado y efectivo esperado de la caja actual.", parameters: { type: "object", properties: {}, required: [], additionalProperties: false }, strict: true },
  { type: "function", name: "get_product_performance", description: "Ventas y margen de un producto mencionado.", parameters: { type: "object", properties: { productReference: { type: "string", maxLength: 120 }, ...periodProperties }, required: ["productReference", "kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_sales_patterns", description: "Días, horarios o tendencia de ventas.", parameters: { type: "object", properties: { ...periodProperties, focus: { type: "string", enum: ["DAYS", "HOURS", "TREND"] } }, required: ["kind", "month", "focus"], additionalProperties: false }, strict: true },
  { type: "function", name: "getProductProfitability", description: "Productos con mayor y menor margen.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
  { type: "function", name: "getAutomaticInsights", description: "Hasta cinco hallazgos respaldados por datos.", parameters: { type: "object", properties: periodProperties, required: ["kind", "month"], additionalProperties: false }, strict: true },
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
    TODAY: "hoy", YESTERDAY: "ayer", CURRENT_WEEK: "esta semana", PREVIOUS_WEEK: "semana pasada", LAST_7_DAYS: "últimos 7 días", LAST_30_DAYS: "últimos 30 días",
    CURRENT_MONTH: "este mes", PREVIOUS_MONTH: "mes pasado", CURRENT_YEAR: "este año", SPECIFIC_MONTH: selection.month ?? "mes solicitado", CUSTOM_RANGE: "rango solicitado",
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
  const { selection, context, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getFinancialAnalyticsForRangesForUser(userId, ranges, context.businessId);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  return {
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    salesCents: analytics.current.salesCents, sales: formatMoney(analytics.current.salesCents), operations: analytics.current.operations,
    costOfGoodsSoldCents: analytics.current.cogsCents, costOfGoodsSold: formatMoney(analytics.current.cogsCents), grossMarginCents: analytics.current.grossMarginCents, grossMargin: formatMoney(analytics.current.grossMarginCents),
    expensesCents: analytics.current.expensesCents, expenses: formatMoney(analytics.current.expensesCents), estimatedResultCents: analytics.current.estimatedResultCents, estimatedResult: formatMoney(analytics.current.estimatedResultCents),
    averageTicket: formatMoney(analytics.current.averageTicketCents), grossMarginPercent: analytics.current.grossMarginPercent,
    previous: {
      salesCents: analytics.previous.salesCents, sales: formatMoney(analytics.previous.salesCents), operations: analytics.previous.operations,
      costOfGoodsSoldCents: analytics.previous.cogsCents, costOfGoodsSold: formatMoney(analytics.previous.cogsCents),
      grossMarginCents: analytics.previous.grossMarginCents, grossMargin: formatMoney(analytics.previous.grossMarginCents),
      expensesCents: analytics.previous.expensesCents, expenses: formatMoney(analytics.previous.expensesCents),
      estimatedResultCents: analytics.previous.estimatedResultCents, estimatedResult: formatMoney(analytics.previous.estimatedResultCents),
      averageTicketCents: analytics.previous.averageTicketCents, averageTicket: formatMoney(analytics.previous.averageTicketCents),
    },
    differences: {
      salesCents: analytics.current.salesCents - analytics.previous.salesCents,
      operations: analytics.current.operations - analytics.previous.operations,
      grossMarginCents: analytics.current.grossMarginCents - analytics.previous.grossMarginCents,
      expensesCents: analytics.current.expensesCents - analytics.previous.expensesCents,
      estimatedResultCents: analytics.current.estimatedResultCents - analytics.previous.estimatedResultCents,
      averageTicketCents: analytics.current.averageTicketCents - analytics.previous.averageTicketCents,
    },
    comparisonsPercent: analytics.comparisons,
    comparisonPeriod: analytics.ranges.previous,
    dataSufficiency: { hasSales: analytics.current.operations > 0, previousHasSales: analytics.previous.operations > 0 },
  };
}

async function getTopProductAnalysis(userId: string, rawArguments: unknown) {
  const { selection, context, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getFinancialAnalyticsForRangesForUser(userId, ranges, context.businessId);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  const leader = analytics.mostSold;
  if (!leader) {
    return { period: periodLabel(selection, ranges.current.start, ranges.current.end), hasSales: false, product: null };
  }
  const sql = getSqlClient();
  const rows = await sql`
    select
      coalesce(sum(si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::int as current_units,
      coalesce(sum(si.subtotal_cents) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::bigint as current_sales,
      coalesce(sum((si.unit_price_cents - si.unit_cost_cents) * si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::bigint as current_margin,
      coalesce(sum(si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.previous.start}::date and ${ranges.previous.end}::date), 0)::int as previous_units,
      coalesce(sum(si.subtotal_cents) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.previous.start}::date and ${ranges.previous.end}::date), 0)::bigint as previous_sales,
      coalesce(sum((si.unit_price_cents - si.unit_cost_cents) * si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.previous.start}::date and ${ranges.previous.end}::date), 0)::bigint as previous_margin,
      coalesce(max(p.current_stock), 0)::int as current_stock,
      coalesce(max(p.minimum_stock), 0)::int as minimum_stock
    from sale_item si
    inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
    left join product p on p.id = si.product_id and p.business_id = si.business_id
    where s.business_id = ${context.businessId} and s.status = 'COMPLETED'
      and si.product_id = ${leader.productId}
      and (
        timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
        or timezone(${context.timezone}, s.created_at)::date between ${ranges.previous.start}::date and ${ranges.previous.end}::date
      )
  `;
  const row = rows[0];
  const current = { units: Number(row.current_units), salesCents: Number(row.current_sales), grossMarginCents: Number(row.current_margin) };
  const previous = { units: Number(row.previous_units), salesCents: Number(row.previous_sales), grossMarginCents: Number(row.previous_margin) };
  return {
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    comparisonPeriod: ranges.previous,
    hasSales: true,
    product: leader.name,
    current: { ...current, sales: formatMoney(current.salesCents), grossMargin: formatMoney(current.grossMarginCents), currentStock: Number(row.current_stock), minimumStock: Number(row.minimum_stock) },
    previous: { ...previous, sales: formatMoney(previous.salesCents), grossMargin: formatMoney(previous.grossMarginCents) },
    changesPercent: {
      units: percentageChange(current.units, previous.units),
      sales: percentageChange(current.salesCents, previous.salesCents),
      grossMargin: percentageChange(current.grossMarginCents, previous.grossMarginCents),
    },
  };
}

async function getProductSalesRanking(userId: string, rawArguments: unknown) {
  const parsed = productSalesRankingSchema.parse(rawArguments);
  const { selection, context, ranges } = await resolveToolPeriod(userId, parsed);
  const sql = getSqlClient();
  const rows = await sql`
    with period_sales as (
      select si.product_id,
        sum(si.quantity)::int as units_sold,
        sum(si.unit_price_cents * si.quantity)::bigint as revenue_cents,
        sum(si.unit_cost_cents * si.quantity)::bigint as cogs_cents
      from sale_item si
      inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
      where s.business_id = ${context.businessId} and s.status = 'COMPLETED'
        and timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
      group by si.product_id
    ), last_sales as (
      select si.product_id, max(timezone(${context.timezone}, s.created_at)::date) as last_sale_date
      from sale_item si
      inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
      where s.business_id = ${context.businessId} and s.status = 'COMPLETED'
      group by si.product_id
    )
    select p.id, p.name, p.current_stock,
      coalesce(ps.units_sold, 0)::int as units_sold,
      coalesce(ps.revenue_cents, 0)::bigint as revenue_cents,
      coalesce(ps.cogs_cents, 0)::bigint as cogs_cents,
      ls.last_sale_date::text,
      case when ls.last_sale_date is null then null else (${context.today}::date - ls.last_sale_date)::int end as days_without_sales
    from product p
    left join period_sales ps on ps.product_id = p.id
    left join last_sales ls on ls.product_id = p.id
    where p.business_id = ${context.businessId} and p.is_active = true
      and (
        (${parsed.ranking} = 'NO_SALES' and coalesce(ps.units_sold, 0) = 0)
        or (${parsed.ranking} <> 'NO_SALES' and coalesce(ps.units_sold, 0) > 0)
      )
    order by
      case when ${parsed.ranking} = 'MOST_UNITS' then coalesce(ps.units_sold, 0) end desc,
      case when ${parsed.ranking} = 'LEAST_UNITS' then coalesce(ps.units_sold, 0) end asc,
      case when ${parsed.ranking} = 'MOST_REVENUE' then coalesce(ps.revenue_cents, 0) end desc,
      case when ${parsed.ranking} = 'LEAST_REVENUE' then coalesce(ps.revenue_cents, 0) end asc,
      case when ${parsed.ranking} = 'NO_SALES' then ls.last_sale_date end asc nulls first,
      p.name asc
    limit ${parsed.limit}
  `;
  const products = rows.map((row) => {
    const revenueCents = Number(row.revenue_cents);
    const cogsCents = Number(row.cogs_cents);
    const grossMarginCents = revenueCents - cogsCents;
    return {
      productId: String(row.id), productName: String(row.name), unitsSold: Number(row.units_sold),
      revenueCents, revenue: formatMoney(revenueCents), cogsCents, cogs: formatMoney(cogsCents),
      grossMarginCents, grossMargin: formatMoney(grossMarginCents), marginPercent: percentageOf(grossMarginCents, revenueCents),
      currentStock: Number(row.current_stock), lastSaleDate: row.last_sale_date ? String(row.last_sale_date) : null,
      daysWithoutSales: row.days_without_sales === null ? null : Number(row.days_without_sales),
    };
  });
  const productCountRows = await sql`
    select count(*)::int as count from product
    where business_id = ${context.businessId} and is_active = true
  `;
  return {
    ranking: parsed.ranking,
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    hasProducts: Number(productCountRows[0]?.count ?? 0) > 0,
    hasSales: parsed.ranking === "NO_SALES" ? undefined : products.length > 0,
    products,
  };
}

async function getStockAttention(
  userId: string,
  focus: "LOW_STOCK" | "LOWEST_STOCK" | "OUT_OF_STOCK" | "BELOW_MINIMUM" = "LOW_STOCK",
  days = 30,
) {
  const sql = getSqlClient();
  const productCountRows = await sql`
    select count(*)::int as count
    from product p inner join business_member bm on bm.business_id = p.business_id
    where bm.user_id = ${userId} and bm.role in ('OWNER', 'ADMIN') and p.is_active = true
  `;
  const rows = await sql`
    with context as (
      select b.id as business_id, b.timezone, timezone(b.timezone, now())::date as today
      from business b inner join business_member bm on bm.business_id = b.id
      where bm.user_id = ${userId} and bm.role in ('OWNER', 'ADMIN') limit 1
    ), recent_sales as (
      select si.product_id, sum(si.quantity)::int as units
      from sale_item si inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
      inner join context c on c.business_id = s.business_id
      where s.status = 'COMPLETED' and timezone(c.timezone, s.created_at)::date between c.today - (${days}::int - 1) and c.today
      group by si.product_id
    )
    select p.id, p.name, p.current_stock, p.minimum_stock, coalesce(rs.units, 0)::int as recent_units
    from product p inner join context c on c.business_id = p.business_id
    left join recent_sales rs on rs.product_id = p.id
    where p.is_active = true and (
      ${focus} = 'LOWEST_STOCK'
      or (${focus} = 'OUT_OF_STOCK' and p.current_stock = 0)
      or (${focus} = 'BELOW_MINIMUM' and p.minimum_stock > 0 and p.current_stock < p.minimum_stock)
      or (${focus} = 'LOW_STOCK' and (p.current_stock = 0 or (p.minimum_stock > 0 and p.current_stock <= p.minimum_stock)))
    )
    order by p.current_stock asc, coalesce(rs.units, 0) desc, p.name asc limit 20
  `;
  return {
    hasProducts: Number(productCountRows[0]?.count ?? 0) > 0,
    count: rows.length,
    products: rows.map((row) => ({ productId: String(row.id), name: String(row.name), currentStock: Number(row.current_stock), minimumStock: Number(row.minimum_stock), unitsSold: Number(row.recent_units) })),
  };
}

async function getProductLeaders(userId: string, rawArguments: unknown) {
  const { selection, context, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getFinancialAnalyticsForRangesForUser(userId, ranges, context.businessId);
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
  const { selection, context, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getFinancialAnalyticsForRangesForUser(userId, ranges, context.businessId);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  const sql = getSqlClient();
  const categoryRows = await sql`
    select c.id, c.name,
      coalesce(sum(e.amount_cents) filter (where e.expense_date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::bigint as current_amount,
      coalesce(sum(e.amount_cents) filter (where e.expense_date between ${ranges.previous.start}::date and ${ranges.previous.end}::date), 0)::bigint as previous_amount
    from expense_category c
    left join expense e on e.category_id = c.id and e.business_id = c.business_id and e.status = 'ACTIVE'
      and e.expense_date between ${ranges.previous.start}::date and ${ranges.current.end}::date
    where c.business_id = ${context.businessId}
    group by c.id, c.name
    having coalesce(sum(e.amount_cents) filter (where e.expense_date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0) > 0
      or coalesce(sum(e.amount_cents) filter (where e.expense_date between ${ranges.previous.start}::date and ${ranges.previous.end}::date), 0) > 0
    order by current_amount desc, c.name asc
    limit 20
  `;
  const categories = categoryRows.map((category) => {
    const currentAmountCents = Number(category.current_amount);
    const previousAmountCents = Number(category.previous_amount);
    const differenceCents = currentAmountCents - previousAmountCents;
    return {
      categoryId: String(category.id), name: String(category.name),
      amountCents: currentAmountCents, amount: formatMoney(currentAmountCents),
      previousAmountCents, previousAmount: formatMoney(previousAmountCents),
      differenceCents, difference: formatMoney(differenceCents),
      percentageDifference: percentageChange(currentAmountCents, previousAmountCents),
    };
  });
  const largestCurrent = [...categories].sort((left, right) => right.amountCents - left.amountCents)[0] ?? null;
  const largestAbsoluteIncrease = [...categories].filter((category) => category.differenceCents > 0).sort((left, right) => right.differenceCents - left.differenceCents)[0] ?? null;
  const largestPercentageIncrease = [...categories]
    .filter((category) => category.percentageDifference !== null && category.percentageDifference > 0)
    .sort((left, right) => (right.percentageDifference ?? 0) - (left.percentageDifference ?? 0))[0] ?? null;
  return {
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    comparisonPeriod: ranges.previous,
    totalCents: analytics.current.expensesCents,
    total: formatMoney(analytics.current.expensesCents),
    comparisonPercent: analytics.comparisons.expenses,
    previousTotalCents: analytics.previous.expensesCents,
    previousTotal: formatMoney(analytics.previous.expensesCents),
    differenceCents: analytics.current.expensesCents - analytics.previous.expensesCents,
    difference: formatMoney(analytics.current.expensesCents - analytics.previous.expensesCents),
    categories,
    highlights: { largestCurrent, largestAbsoluteIncrease, largestPercentageIncrease },
  };
}

async function getCashSummary(userId: string) {
  const [cash, sessions] = await Promise.all([getOpenCashSessionForUser(userId), getCashSessionsForUser(userId)]);
  const latestClosed = sessions.find((session) => session.status === "CLOSED");
  const closedView = latestClosed ? {
    openedAt: latestClosed.openedAt.toISOString(), closedAt: latestClosed.closedAt?.toISOString() ?? null,
    expectedCashCents: latestClosed.expectedCashCents, expectedCash: formatMoney(latestClosed.expectedCashCents),
    declaredCashCents: latestClosed.declaredCashCents, declaredCash: latestClosed.declaredCashCents === null ? null : formatMoney(latestClosed.declaredCashCents),
    differenceCents: latestClosed.differenceCents, difference: latestClosed.differenceCents === null ? null : formatMoney(latestClosed.differenceCents),
  } : null;
  return cash ? {
    status: "OPEN", openedAt: cash.openedAt.toISOString(), openingAmountCents: cash.openingAmountCents, openingAmount: formatMoney(cash.openingAmountCents),
    expectedCashCents: cash.expectedCashCents, expectedCash: formatMoney(cash.expectedCashCents), cashSalesCents: cash.cashSalesCents, cashSales: formatMoney(cash.cashSalesCents),
    cashExpensesCents: cash.cashExpensesCents, cashExpenses: formatMoney(cash.cashExpensesCents), operations: cash.cashOperations,
    latestClosed: closedView,
  } : { status: "CLOSED", latestClosed: closedView };
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
      return { name: String(row.name), currentStock: Number(row.current_stock), minimumStock: Number(row.minimum_stock), units: Number(row.units), salesCents, sales: formatMoney(salesCents), grossMarginCents: totals.grossMarginCents, grossMargin: formatMoney(totals.grossMarginCents), marginPercent: percentageOf(totals.grossMarginCents, salesCents), lastSale: row.last_sale ? String(row.last_sale) : null };
    }),
  };
}

async function getIntelligentPeriod(userId: string, rawArguments: unknown) {
  const { selection, context, ranges } = await resolveToolPeriod(userId, rawArguments);
  const analytics = await getIntelligentAnalyticsForUser(userId, ranges, 30, context.businessId);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  return { analytics, period: periodLabel(selection, ranges.current.start, ranges.current.end) };
}

function intelligentProductView(product: IntelligentProduct) {
  return {
    productId: product.productId, productName: product.name, unitsSold: product.units,
    revenueCents: product.salesCents, revenue: formatMoney(product.salesCents),
    cogsCents: product.cogsCents, cogs: formatMoney(product.cogsCents),
    grossMarginCents: product.grossMarginCents, grossMargin: formatMoney(product.grossMarginCents),
    marginPercent: product.marginPercent, currentStock: product.currentStock, minimumStock: product.minimumStock,
  };
}

async function getBusinessPeriodAnalysis(userId: string, rawArguments: unknown) {
  const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
  const current = analytics.financial.current;
  const previous = analytics.financial.previous;
  const excess = [...analytics.inventory.products]
    .filter((product) => product.currentStock > product.minimumStock)
    .sort((left, right) => (right.estimatedDaysRemaining ?? Number.MAX_SAFE_INTEGER) - (left.estimatedDaysRemaining ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 5);
  return {
    period,
    salesCents: current.salesCents, sales: formatMoney(current.salesCents), operations: current.operations,
    costOfGoodsSoldCents: current.cogsCents, costOfGoodsSold: formatMoney(current.cogsCents),
    grossMarginCents: current.grossMarginCents, grossMargin: formatMoney(current.grossMarginCents), grossMarginPercent: current.grossMarginPercent,
    expensesCents: current.expensesCents, expenses: formatMoney(current.expensesCents),
    estimatedResultCents: current.estimatedResultCents, estimatedResult: formatMoney(current.estimatedResultCents),
    averageTicketCents: current.averageTicketCents, averageTicket: formatMoney(current.averageTicketCents),
    previous: {
      salesCents: previous.salesCents, sales: formatMoney(previous.salesCents), operations: previous.operations,
      grossMarginCents: previous.grossMarginCents, grossMargin: formatMoney(previous.grossMarginCents),
      expensesCents: previous.expensesCents, expenses: formatMoney(previous.expensesCents),
      estimatedResultCents: previous.estimatedResultCents, estimatedResult: formatMoney(previous.estimatedResultCents),
      averageTicketCents: previous.averageTicketCents, averageTicket: formatMoney(previous.averageTicketCents),
    },
    comparisonsPercent: analytics.financial.comparisons,
    comparisonPeriod: analytics.financial.ranges.previous,
    products: {
      mostSoldByUnits: analytics.rankings.byUnits[0] ? intelligentProductView(analytics.rankings.byUnits[0]) : null,
      highestRevenue: analytics.rankings.byRevenue[0] ? intelligentProductView(analytics.rankings.byRevenue[0]) : null,
      highestGrossMargin: analytics.rankings.byProfitability[0] ? intelligentProductView(analytics.rankings.byProfitability[0]) : null,
      lowestMargin: analytics.rankings.lowestMargin[0] ? intelligentProductView(analytics.rankings.lowestMargin[0]) : null,
    },
    inventory: {
      reorder: analytics.inventory.reorderCandidates.slice(0, 5).map(inventoryProductView),
      slowMoving: analytics.rankings.slowMoving.slice(0, 5).map(inventoryProductView),
      excess: excess.map(inventoryProductView),
    },
    patterns: {
      sufficientData: analytics.patterns.sufficient,
      reason: analytics.patterns.reason,
      strongestDay: analytics.patterns.strongestDay,
      strongestHour: analytics.patterns.strongestHour,
    },
    dataSufficiency: { hasSales: current.operations > 0, previousHasSales: previous.operations > 0 },
  };
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
  const analytics = await getIntelligentAnalyticsForUser(userId, ranges, days, context.businessId);
  if (!analytics) throw new Error("AI_FORBIDDEN");
  return { days, analytics };
}

function inventoryProductView(product: IntelligentProduct) {
  return {
    productId: product.productId, name: product.name, currentStock: product.currentStock, minimumStock: product.minimumStock,
    unitsSold: product.unitsInVelocityWindow, averageDailySales: product.averageDailySales,
    estimatedDaysRemaining: product.estimatedDaysRemaining, priority: product.reorderPriority,
    confidence: product.confidence, lastSale: product.lastSale,
  };
}

async function getInventoryAnalysis(userId: string, rawArguments: unknown) {
  const { focus, days } = inventoryAnalysisSchema.parse(rawArguments);
  if (["LOW_STOCK", "LOWEST_STOCK", "OUT_OF_STOCK", "BELOW_MINIMUM"].includes(focus)) {
    const result = await getStockAttention(userId, focus as "LOW_STOCK" | "LOWEST_STOCK" | "OUT_OF_STOCK" | "BELOW_MINIMUM", days);
    return { focus, days, hasProducts: result.hasProducts, count: result.count, products: result.products.slice(0, 8) };
  }
  const { analytics } = await getInventoryAnalytics(userId, { days });
  const hasProducts = analytics.inventory.products.length > 0;
  if (focus === "REORDER") {
    return { focus, days, hasProducts, products: analytics.inventory.reorderCandidates.slice(0, 8).map(inventoryProductView) };
  }
  if (focus === "SLOW") {
    return { focus, days, hasProducts, newProductThresholdDays: 14, products: analytics.rankings.slowMoving.slice(0, 8).map(inventoryProductView) };
  }
  const products = [...analytics.inventory.products]
    .filter((product) => product.currentStock > product.minimumStock)
    .sort((left, right) => (right.estimatedDaysRemaining ?? Number.MAX_SAFE_INTEGER) - (left.estimatedDaysRemaining ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 8)
    .map(inventoryProductView);
  return { focus, days, hasProducts, methodology: "mayor cobertura de stock al ritmo reciente", products };
}

async function getSalesPatterns(userId: string, rawArguments: unknown) {
  const parsed = salesPatternsSchema.parse(rawArguments);
  const { analytics, period } = await getIntelligentPeriod(userId, parsed);
  if (parsed.focus === "DAYS") {
    return { focus: parsed.focus, period, sufficientData: analytics.patterns.sufficient, reason: analytics.patterns.reason, strongest: analytics.patterns.strongestDay, days: analytics.patterns.weekdays };
  }
  if (parsed.focus === "HOURS") {
    return { focus: parsed.focus, period, sufficientData: analytics.patterns.sufficient, reason: analytics.patterns.reason, strongest: analytics.patterns.strongestHour, weakest: analytics.patterns.weakestHour, bands: analytics.patterns.hours };
  }
  return { focus: parsed.focus, period, sufficientData: analytics.evolution.length > 1, reason: analytics.evolution.length > 1 ? null : "Todavía no hay suficientes días para mostrar una tendencia.", comparisonsPercent: analytics.financial.comparisons, daily: analytics.evolution.slice(-31) };
}


// ---------------------------------------------------------------------------
// Cuenta corriente de clientes: solo lectura. DEETA AI puede consultar saldos
// y pagos, pero no registrar pagos, modificar clientes, perdonar deuda ni
// hacer ajustes.

const customerBalancesSchema = z.object({ focus: z.enum(["DEBTORS", "TOP_DEBTOR", "OLDEST_UNPAID"]) });
const customerAccountSchema = z.object({ customerReference: z.string().trim().min(2).max(120) });

function shortDate(value: unknown, timezone: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: timezone }).format(new Date(String(value)));
}

function daysSince(value: unknown) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(String(value)).getTime()) / 86_400_000));
}

async function getCustomerBalances(userId: string, rawArguments: unknown) {
  const { focus } = customerBalancesSchema.parse(rawArguments);
  const context = await getAiContextForUser(userId);
  if (!context) throw new Error("AI_FORBIDDEN");
  const sql = getSqlClient();
  const rows = await sql`
    select c.name, c.balance_cents, c.last_movement_at,
      (select max(m.created_at) from customer_account_movement m
        where m.customer_id = c.id and m.business_id = c.business_id and m.type = 'PAYMENT') as last_payment_at,
      (select min(m.created_at) from customer_account_movement m
        where m.customer_id = c.id and m.business_id = c.business_id and m.amount_cents > 0) as first_debt_at
    from customer c
    where c.business_id = ${context.businessId} and c.balance_cents > 0
  `;
  const customers = rows.map((row) => {
    const sinceValue = row.last_payment_at ?? row.first_debt_at;
    return {
      name: String(row.name),
      balanceCents: Number(row.balance_cents),
      balance: formatMoney(Number(row.balance_cents)),
      lastMovementDate: shortDate(row.last_movement_at, context.timezone),
      lastPaymentDate: shortDate(row.last_payment_at, context.timezone),
      daysWithoutPayment: daysSince(sinceValue),
    };
  });
  const sorted = focus === "OLDEST_UNPAID"
    ? [...customers].sort((left, right) => (right.daysWithoutPayment ?? 0) - (left.daysWithoutPayment ?? 0) || right.balanceCents - left.balanceCents)
    : [...customers].sort((left, right) => right.balanceCents - left.balanceCents);
  const totalPendingCents = customers.reduce((total, customer) => total + customer.balanceCents, 0);
  return {
    focus,
    totalPendingCents,
    totalPending: formatMoney(totalPendingCents),
    debtors: customers.length,
    customers: sorted.slice(0, focus === "DEBTORS" ? 8 : 3),
  };
}

async function getCustomerAccount(userId: string, rawArguments: unknown) {
  const { customerReference } = customerAccountSchema.parse(rawArguments);
  const context = await getAiContextForUser(userId);
  if (!context) throw new Error("AI_FORBIDDEN");
  const sql = getSqlClient();
  const pattern = `%${customerReference.replace(/[%_]/g, "")}%`;
  const matches = await sql`
    select c.id, c.name, c.balance_cents, c.last_movement_at
    from customer c
    where c.business_id = ${context.businessId} and c.name ilike ${pattern}
    order by c.balance_cents desc, c.name asc
    limit 3
  `;
  if (!matches[0]) return { customerReference, found: false, matches: [] as string[], customer: null };
  const customer = matches[0];
  // "Compras pendientes": ventas fiadas desde la última vez que el cliente
  // quedó al día (saldo cero).
  const pending = await sql`
    with last_zero as (
      select max(m.created_at) as at from customer_account_movement m
      where m.customer_id = ${customer.id} and m.business_id = ${context.businessId} and m.balance_after_cents = 0
    )
    select m.created_at, m.amount_cents, m.sale_id,
      (select string_agg(si.quantity || ' × ' || si.product_name_snapshot, ', ' order by si.product_name_snapshot)
        from sale_item si where si.sale_id = m.sale_id and si.business_id = m.business_id) as items
    from customer_account_movement m, last_zero lz
    where m.customer_id = ${customer.id} and m.business_id = ${context.businessId}
      and m.type = 'CREDIT_SALE'
      and (lz.at is null or m.created_at > lz.at)
    order by m.created_at desc
    limit 8
  `;
  const lastPayment = await sql`
    select m.created_at, m.amount_cents from customer_account_movement m
    where m.customer_id = ${customer.id} and m.business_id = ${context.businessId} and m.type = 'PAYMENT'
    order by m.created_at desc limit 1
  `;
  return {
    customerReference,
    found: true,
    matches: matches.map((match) => String(match.name)),
    customer: {
      name: String(customer.name),
      balanceCents: Number(customer.balance_cents),
      balance: formatMoney(Number(customer.balance_cents)),
      lastMovementDate: shortDate(customer.last_movement_at, context.timezone),
      lastPayment: lastPayment[0] ? { date: shortDate(lastPayment[0].created_at, context.timezone), amount: formatMoney(-Number(lastPayment[0].amount_cents)) } : null,
      pendingPurchases: Number(customer.balance_cents) > 0 ? pending.map((row) => ({
        date: shortDate(row.created_at, context.timezone),
        amountCents: Number(row.amount_cents),
        amount: formatMoney(Number(row.amount_cents)),
        items: row.items ? String(row.items) : null,
      })) : [],
    },
  };
}

async function getCustomerPayments(userId: string, rawArguments: unknown) {
  const { selection, context, ranges } = await resolveToolPeriod(userId, rawArguments);
  const sql = getSqlClient();
  const rows = await sql`
    select m.payment_method, count(*)::int as operations, coalesce(sum(-m.amount_cents), 0)::bigint as amount_cents
    from customer_account_movement m
    where m.business_id = ${context.businessId} and m.type = 'PAYMENT'
      and timezone(${context.timezone}, m.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
    group by m.payment_method
    order by amount_cents desc
  `;
  const labels: Record<string, string> = { CASH: "Efectivo", TRANSFER: "Transferencia", CARD: "Tarjeta" };
  const totalCents = rows.reduce((total, row) => total + Number(row.amount_cents), 0);
  return {
    period: periodLabel(selection, ranges.current.start, ranges.current.end),
    totalCents,
    total: formatMoney(totalCents),
    operations: rows.reduce((total, row) => total + Number(row.operations), 0),
    byMethod: rows.map((row) => ({ method: labels[String(row.payment_method)] ?? String(row.payment_method), amountCents: Number(row.amount_cents), amount: formatMoney(Number(row.amount_cents)), operations: Number(row.operations) })),
  };
}

export function createAiToolExecutor(userId: string) {
  return async (name: string, rawArguments: unknown) => {
    if (name === "get_period_summary") return getPeriodSummary(userId, rawArguments);
    if (name === "get_business_period_analysis") return getBusinessPeriodAnalysis(userId, rawArguments);
    if (name === "get_top_product_analysis") return getTopProductAnalysis(userId, rawArguments);
    if (name === "get_product_sales_ranking") return getProductSalesRanking(userId, rawArguments);
    if (name === "get_inventory_analysis") return getInventoryAnalysis(userId, rawArguments);
    if (name === "get_stock_attention") return getStockAttention(userId);
    if (name === "get_product_leaders") return getProductLeaders(userId, rawArguments);
    if (name === "get_slow_moving_products") return getSlowMovingProducts(userId, rawArguments);
    if (name === "get_expense_breakdown") return getExpenseBreakdown(userId, rawArguments);
    if (name === "get_cash_summary") return getCashSummary(userId);
    if (name === "get_customer_balances") return getCustomerBalances(userId, rawArguments);
    if (name === "get_customer_account") return getCustomerAccount(userId, rawArguments);
    if (name === "get_customer_payments") return getCustomerPayments(userId, rawArguments);
    if (name === "get_product_performance") return getProductPerformance(userId, rawArguments);
    if (name === "get_sales_patterns") return getSalesPatterns(userId, rawArguments);
    if (name === "getSalesTrends") {
      const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
      return { period, comparisonsPercent: analytics.financial.comparisons, daily: analytics.evolution.slice(-60) };
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
      return { days, methodology: `unidades vendidas / ${days} días calendario`, products: analytics.inventory.products.slice(0, 8).map(inventoryProductView) };
    }
    if (name === "getSlowMovingProducts") {
      const { days, analytics } = await getInventoryAnalytics(userId, rawArguments);
      return { days, newProductThresholdDays: 14, products: analytics.rankings.slowMoving.slice(0, 8).map(inventoryProductView) };
    }
    if (name === "getStockCoverage") {
      const { days, analytics } = await getInventoryAnalytics(userId, rawArguments);
      return { days, methodology: "stock actual / promedio diario; null cuando el promedio es cero", products: analytics.inventory.products.slice(0, 8).map(inventoryProductView) };
    }
    if (name === "getReorderCandidates") {
      const { days, analytics } = await getInventoryAnalytics(userId, rawArguments);
      return { days, rules: { urgent: "sin stock, en/bajo mínimo o hasta 3 días", soon: "hasta 7 días o cerca del mínimo" }, products: analytics.inventory.reorderCandidates.slice(0, 8).map(inventoryProductView) };
    }
    if (name === "getAutomaticInsights") {
      const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
      return { period, insights: analytics.insights };
    }
    if (name === "getProductProfitability") {
      const { analytics, period } = await getIntelligentPeriod(userId, rawArguments);
      const view = (product: (typeof analytics.products)[number]) => ({ name: product.name, units: product.units, revenueCents: product.salesCents, revenue: formatMoney(product.salesCents), cogsCents: product.cogsCents, cogs: formatMoney(product.cogsCents), grossMarginCents: product.grossMarginCents, grossMargin: formatMoney(product.grossMarginCents), marginPercent: product.marginPercent });
      const highestMarginPercent = [...analytics.products]
        .filter((product) => product.units > 0 && product.marginPercent !== null)
        .sort((left, right) => (right.marginPercent ?? 0) - (left.marginPercent ?? 0) || right.grossMarginCents - left.grossMarginCents)
        .slice(0, 5);
      return {
        period,
        methodology: "costos históricos guardados en cada ítem de venta",
        mostProfitable: analytics.rankings.byProfitability.slice(0, 5).map(view),
        highestMarginPercent: highestMarginPercent.map(view),
        lowestMargin: analytics.rankings.lowestMargin.slice(0, 5).map(view),
      };
    }
    throw new Error("AI_TOOL_NOT_ALLOWED");
  };
}
