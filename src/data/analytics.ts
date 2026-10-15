import "server-only";

import { getAnalyticsContextForUser } from "@/data/analytics-context";
import { getSqlClient } from "@/db";
import { calculateFinancialResult, percentageChange, percentageOf } from "@/lib/finance";
import { resolveAnalysisPeriod, type AnalysisPeriod, type DateRange } from "@/lib/periods";

type RawTotals = { salesCents: number; cogsCents: number; expensesCents: number; operations: number };

export type ProductProfitability = {
  productId: string; name: string; units: number; salesCents: number; cogsCents: number;
  grossMarginCents: number; marginPercent: number | null;
};

function mapProduct(row: Record<string, unknown>): ProductProfitability {
  const salesCents = Number(row.sales_cents); const cogsCents = Number(row.cogs_cents);
  const grossMarginCents = salesCents - cogsCents;
  return { productId: String(row.product_id), name: String(row.product_name_snapshot), units: Number(row.units), salesCents, cogsCents, grossMarginCents, marginPercent: percentageOf(grossMarginCents, salesCents) };
}

export async function getFinancialAnalyticsForUser(
  userId: string,
  period: AnalysisPeriod,
  rangesOverride?: { current: DateRange; previous: DateRange },
  businessIdOverride?: string,
  includeBreakdowns = true,
) {
  const sql = getSqlClient();
  const context = await getAnalyticsContextForUser(userId, businessIdOverride);
  if (!context) return null;
  const businessId = context.businessId;
  const timezone = context.timezone;
  const ranges = rangesOverride ?? resolveAnalysisPeriod(context.today, period);

  const rows = await sql`
    with scoped_sales as (
      select s.id, s.total_cents, s.payment_method,
        timezone(${timezone}, s.created_at)::date as local_date
      from sale s where s.business_id = ${businessId} and s.status = 'COMPLETED'
        and timezone(${timezone}, s.created_at)::date between ${ranges.previous.start}::date and ${ranges.current.end}::date
    ), sale_values as (
      select ss.id, ss.total_cents, ss.payment_method, ss.local_date,
        coalesce(sum(si.unit_cost_cents * si.quantity), 0)::bigint as cogs_cents
      from scoped_sales ss left join sale_item si on si.sale_id = ss.id and si.business_id = ${businessId}
      group by ss.id, ss.total_cents, ss.payment_method, ss.local_date
    ), sales_summary as (
      select
        coalesce(sum(total_cents) filter (where local_date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::bigint as current_sales,
        coalesce(sum(cogs_cents) filter (where local_date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::bigint as current_cogs,
        count(*) filter (where local_date between ${ranges.current.start}::date and ${ranges.current.end}::date)::int as current_operations,
        coalesce(sum(total_cents) filter (where local_date between ${ranges.previous.start}::date and ${ranges.previous.end}::date), 0)::bigint as previous_sales,
        coalesce(sum(cogs_cents) filter (where local_date between ${ranges.previous.start}::date and ${ranges.previous.end}::date), 0)::bigint as previous_cogs,
        count(*) filter (where local_date between ${ranges.previous.start}::date and ${ranges.previous.end}::date)::int as previous_operations,
        coalesce(sum(total_cents) filter (where local_date between ${ranges.current.start}::date and ${ranges.current.end}::date and payment_method = 'CASH'), 0)::bigint as cash_sales,
        coalesce(sum(total_cents) filter (where local_date between ${ranges.current.start}::date and ${ranges.current.end}::date and payment_method = 'TRANSFER'), 0)::bigint as transfer_sales,
        coalesce(sum(total_cents) filter (where local_date between ${ranges.current.start}::date and ${ranges.current.end}::date and payment_method = 'CARD'), 0)::bigint as card_sales
      from sale_values
    ), expense_summary as (
      select
        coalesce(sum(amount_cents) filter (where expense_date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::bigint as current_expenses,
        coalesce(sum(amount_cents) filter (where expense_date between ${ranges.previous.start}::date and ${ranges.previous.end}::date), 0)::bigint as previous_expenses
      from expense where business_id = ${businessId} and status = 'ACTIVE'
        and expense_date between ${ranges.previous.start}::date and ${ranges.current.end}::date
    )
    select * from sales_summary cross join expense_summary
  `;
  const row = rows[0];
  const currentRaw: RawTotals = {
    salesCents: Number(row.current_sales), cogsCents: Number(row.current_cogs),
    expensesCents: Number(row.current_expenses), operations: Number(row.current_operations),
  };
  const previousRaw: RawTotals = {
    salesCents: Number(row.previous_sales), cogsCents: Number(row.previous_cogs),
    expensesCents: Number(row.previous_expenses), operations: Number(row.previous_operations),
  };
  const current = calculateFinancialResult(currentRaw);
  const previous = calculateFinancialResult(previousRaw);

  const [productRows, categoryRows, mostSoldRows, mostRevenueRows] = includeBreakdowns ? await Promise.all([
    sql`
      select si.product_id, max(si.product_name_snapshot) as product_name_snapshot,
        sum(si.quantity)::int as units,
        sum(si.unit_price_cents * si.quantity)::bigint as sales_cents,
        sum(si.unit_cost_cents * si.quantity)::bigint as cogs_cents
      from sale_item si inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
      where s.business_id = ${businessId} and s.status = 'COMPLETED'
        and timezone(${timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
      group by si.product_id
      order by (sum(si.unit_price_cents * si.quantity) - sum(si.unit_cost_cents * si.quantity)) desc
      limit 20
    `,
    sql`
      select c.id, c.name, coalesce(sum(e.amount_cents), 0)::bigint as amount_cents
      from expense_category c inner join expense e on e.category_id = c.id and e.business_id = c.business_id
      where c.business_id = ${businessId} and e.status = 'ACTIVE'
        and e.expense_date between ${ranges.current.start}::date and ${ranges.current.end}::date
      group by c.id, c.name order by amount_cents desc
    `,
    sql`
      select si.product_id, max(si.product_name_snapshot) as product_name_snapshot,
        sum(si.quantity)::int as units,
        sum(si.unit_price_cents * si.quantity)::bigint as sales_cents,
        sum(si.unit_cost_cents * si.quantity)::bigint as cogs_cents
      from sale_item si inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
      where s.business_id = ${businessId} and s.status = 'COMPLETED'
        and timezone(${timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
      group by si.product_id order by sum(si.quantity) desc, sales_cents desc limit 1
    `,
    sql`
      select si.product_id, max(si.product_name_snapshot) as product_name_snapshot,
        sum(si.quantity)::int as units,
        sum(si.unit_price_cents * si.quantity)::bigint as sales_cents,
        sum(si.unit_cost_cents * si.quantity)::bigint as cogs_cents
      from sale_item si inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
      where s.business_id = ${businessId} and s.status = 'COMPLETED'
        and timezone(${timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
      group by si.product_id order by sales_cents desc, units desc limit 1
    `,
  ]) : [[], [], [], []];
  const products = productRows.map((item) => mapProduct(item as Record<string, unknown>));
  return {
    timezone, ranges, current, previous,
    payments: { cashCents: Number(row.cash_sales), transferCents: Number(row.transfer_sales), cardCents: Number(row.card_sales) },
    comparisons: {
      sales: percentageChange(current.salesCents, previous.salesCents),
      grossMargin: percentageChange(current.grossMarginCents, previous.grossMarginCents),
      expenses: percentageChange(current.expensesCents, previous.expensesCents),
      estimatedResult: percentageChange(current.estimatedResultCents, previous.estimatedResultCents),
      operations: percentageChange(current.operations, previous.operations),
      averageTicket: percentageChange(current.averageTicketCents, previous.averageTicketCents),
    },
    products,
    mostSold: mostSoldRows[0] ? mapProduct(mostSoldRows[0] as Record<string, unknown>) : null,
    mostRevenue: mostRevenueRows[0] ? mapProduct(mostRevenueRows[0] as Record<string, unknown>) : null,
    mostProfitable: products[0] ?? null,
    lowMarginProducts: products.filter((item) => item.marginPercent !== null && item.marginPercent <= 10).slice(0, 5),
    expensesByCategory: categoryRows.map((item) => ({ id: String(item.id), name: String(item.name), amountCents: Number(item.amount_cents) })),
  };
}

export function getFinancialAnalyticsForRangesForUser(
  userId: string,
  ranges: { current: DateRange; previous: DateRange },
  businessId?: string,
) {
  return getFinancialAnalyticsForUser(userId, "TODAY", ranges, businessId);
}

export function getFinancialSummaryForUser(userId: string, period: AnalysisPeriod) {
  return getFinancialAnalyticsForUser(userId, period, undefined, undefined, false);
}

export function getFinancialSummaryForRangesForUser(
  userId: string,
  ranges: { current: DateRange; previous: DateRange },
  businessId?: string,
) {
  return getFinancialAnalyticsForUser(userId, "TODAY", ranges, businessId, false);
}
