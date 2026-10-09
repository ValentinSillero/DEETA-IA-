import "server-only";

import { getFinancialAnalyticsForRangesForUser } from "@/data/analytics";
import { getSqlClient } from "@/db";
import { formatMoney } from "@/lib/inventory";
import {
  averageDailySales,
  calendarDays,
  classifyReorder,
  confidenceForHistory,
  estimatedStockDays,
  IMMOBILIZED_WINDOW_DAYS,
  isImmobilized,
  isSlowMoving,
  rankInsights,
  roundMetric,
  type AutomaticInsight,
} from "@/lib/intelligent-analytics";
import type { DateRange } from "@/lib/periods";

type AnalyticsContext = { businessId: string; timezone: string; today: string; historyDays: number };

export type IntelligentProduct = {
  productId: string;
  name: string;
  currentStock: number;
  minimumStock: number;
  currentCostCents: number;
  productAgeDays: number;
  units: number;
  salesCents: number;
  cogsCents: number;
  grossMarginCents: number;
  marginPercent: number | null;
  unitsInVelocityWindow: number;
  averageDailySales: number;
  estimatedDaysRemaining: number | null;
  unitsLast60Days: number;
  lastSale: string | null;
  reorderPriority: "URGENT" | "SOON" | "OK";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  slowMoving: boolean;
  immobilized: boolean;
  immobilizedValueCents: number;
};

export type DailyEvolution = {
  date: string;
  salesCents: number;
  grossMarginCents: number;
  expensesCents: number;
  estimatedResultCents: number;
};

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

async function getAnalyticsContext(userId: string, businessId?: string): Promise<AnalyticsContext | null> {
  const sql = getSqlClient();
  const rows = await sql`
    select b.id as business_id, b.timezone, timezone(b.timezone, now())::date::text as today,
      greatest(1, coalesce(
        timezone(b.timezone, now())::date - min(timezone(b.timezone, s.created_at)::date),
        timezone(b.timezone, now())::date - timezone(b.timezone, b.created_at)::date
      ) + 1)::int as history_days
    from business b
    inner join business_member bm on bm.business_id = b.id and bm.user_id = ${userId}
    left join sale s on s.business_id = b.id and s.status = 'COMPLETED'
    where (${businessId ?? null}::text is null or b.id = ${businessId ?? null})
    group by b.id, b.timezone, b.created_at
    limit 1
  `;
  const row = rows[0];
  return row ? {
    businessId: String(row.business_id),
    timezone: String(row.timezone),
    today: String(row.today),
    historyDays: Number(row.history_days),
  } : null;
}

function marginPercent(salesCents: number, grossMarginCents: number) {
  return salesCents > 0 ? Math.round((grossMarginCents / salesCents) * 10_000) / 100 : null;
}

function buildInsights(values: {
  products: IntelligentProduct[];
  salesComparison: number | null;
  expensesComparison: number | null;
  calculatedAt: string;
}) {
  const insights: AutomaticInsight[] = [];
  const urgent = values.products.filter((product) => product.reorderPriority === "URGENT");
  const immobilized = values.products.filter((product) => product.immobilized);
  const immobilizedValue = immobilized.reduce((total, product) => total + product.immobilizedValueCents, 0);
  if (urgent.length > 0) insights.push({
    type: "REORDER_SOON", severity: "HIGH", title: `${urgent.length} ${urgent.length === 1 ? "producto necesita" : "productos necesitan"} atención`,
    explanation: "El stock actual, el mínimo configurado o el ritmo reciente indican que conviene revisar la reposición.",
    evidence: [{ label: "Reposición urgente", value: String(urgent.length) }, { label: "Primero", value: urgent[0].name }], calculatedAt: values.calculatedAt,
  });
  if (immobilized.length > 0) insights.push({
    type: "HIGH_STOCK_LOW_ROTATION", severity: immobilizedValue >= 100_000 ? "HIGH" : "MEDIUM", title: "Mercadería con poco movimiento",
    explanation: `Hay capital aproximado en productos con una venta o menos durante los últimos ${IMMOBILIZED_WINDOW_DAYS} días.`,
    evidence: [{ label: "Productos", value: String(immobilized.length) }, { label: "Valor aproximado", value: formatMoney(immobilizedValue) }], calculatedAt: values.calculatedAt,
  });
  if (values.salesComparison !== null && Math.abs(values.salesComparison) >= 10) insights.push({
    type: values.salesComparison > 0 ? "SALES_GROWING" : "SALES_FALLING",
    severity: values.salesComparison < 0 ? "HIGH" : "MEDIUM",
    title: `Las ventas ${values.salesComparison > 0 ? "subieron" : "bajaron"} ${Math.abs(values.salesComparison).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`,
    explanation: "La comparación usa un período anterior de la misma duración.",
    evidence: [{ label: "Cambio", value: `${values.salesComparison.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` }], calculatedAt: values.calculatedAt,
  });
  if (values.expensesComparison !== null && values.expensesComparison >= 10) insights.push({
    type: "EXPENSES_GROWING", severity: "MEDIUM", title: "Los gastos aumentaron",
    explanation: "Los gastos activos crecieron frente al período comparable anterior.",
    evidence: [{ label: "Aumento", value: `${values.expensesComparison.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` }], calculatedAt: values.calculatedAt,
  });
  const highMargin = values.products.filter((product) => product.units > 0).sort((a, b) => b.grossMarginCents - a.grossMarginCents)[0];
  if (highMargin) insights.push({
    type: "HIGH_MARGIN", severity: "LOW", title: `${highMargin.name} aportó el mayor margen`,
    explanation: "Se calcula con el precio y el costo guardados en cada venta, no con el costo actual.",
    evidence: [{ label: "Margen generado", value: formatMoney(highMargin.grossMarginCents) }], calculatedAt: values.calculatedAt,
  });
  return rankInsights(insights);
}

export async function getIntelligentAnalyticsForUser(
  userId: string,
  ranges: { current: DateRange; previous: DateRange },
  inventoryDays = 30,
  businessId?: string,
) {
  const context = await getAnalyticsContext(userId, businessId);
  if (!context) return null;
  const sql = getSqlClient();
  const periodDays = calendarDays(ranges.current.start, ranges.current.end);
  const safeInventoryDays = [7, 30, 60].includes(inventoryDays) ? inventoryDays : 30;

  const [financial, productRows, evolutionRows, weekdayRows, hourRows] = await Promise.all([
    getFinancialAnalyticsForRangesForUser(userId, ranges, context.businessId),
    sql`
      with product_sales as (
        select si.product_id,
          coalesce(sum(si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::int as period_units,
          coalesce(sum(si.unit_price_cents * si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::bigint as period_sales,
          coalesce(sum(si.unit_cost_cents * si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date), 0)::bigint as period_cogs,
          coalesce(sum(si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${context.today}::date - (${safeInventoryDays}::int - 1) and ${context.today}::date), 0)::int as velocity_units,
          coalesce(sum(si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date between ${context.today}::date - 59 and ${context.today}::date), 0)::int as units_60,
          max(timezone(${context.timezone}, s.created_at)::date)::text as last_sale
        from sale_item si
        inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
        where s.business_id = ${context.businessId} and s.status = 'COMPLETED'
          and (timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
            or timezone(${context.timezone}, s.created_at)::date between ${context.today}::date - 59 and ${context.today}::date)
        group by si.product_id
      )
      select p.id, p.name, p.current_stock, p.minimum_stock, p.cost_price_cents,
        greatest(1, ${context.today}::date - timezone(${context.timezone}, p.created_at)::date + 1)::int as product_age_days,
        coalesce(ps.period_units, 0)::int as period_units, coalesce(ps.period_sales, 0)::bigint as period_sales,
        coalesce(ps.period_cogs, 0)::bigint as period_cogs, coalesce(ps.velocity_units, 0)::int as velocity_units,
        coalesce(ps.units_60, 0)::int as units_60, ps.last_sale
      from product p left join product_sales ps on ps.product_id = p.id
      where p.business_id = ${context.businessId} and p.is_active = true
      order by p.name asc
    `,
    sql`
      with days as (
        select generate_series(${ranges.current.start}::date, ${ranges.current.end}::date, interval '1 day')::date as day
      ), sales_daily as (
        select timezone(${context.timezone}, s.created_at)::date as day,
          sum(s.total_cents)::bigint as sales_cents,
          sum(si.cogs_cents)::bigint as cogs_cents
        from sale s
        inner join (
          select sale_id, business_id, sum(unit_cost_cents * quantity)::bigint as cogs_cents
          from sale_item where business_id = ${context.businessId} group by sale_id, business_id
        ) si on si.sale_id = s.id and si.business_id = s.business_id
        where s.business_id = ${context.businessId} and s.status = 'COMPLETED'
          and timezone(${context.timezone}, s.created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
        group by day
      ), expense_daily as (
        select expense_date as day, sum(amount_cents)::bigint as expenses_cents
        from expense where business_id = ${context.businessId} and status = 'ACTIVE'
          and expense_date between ${ranges.current.start}::date and ${ranges.current.end}::date
        group by expense_date
      )
      select days.day::text, coalesce(sd.sales_cents, 0)::bigint as sales_cents,
        (coalesce(sd.sales_cents, 0) - coalesce(sd.cogs_cents, 0))::bigint as gross_margin_cents,
        coalesce(ed.expenses_cents, 0)::bigint as expenses_cents,
        (coalesce(sd.sales_cents, 0) - coalesce(sd.cogs_cents, 0) - coalesce(ed.expenses_cents, 0))::bigint as estimated_result_cents
      from days left join sales_daily sd on sd.day = days.day left join expense_daily ed on ed.day = days.day
      order by days.day
    `,
    sql`
      select extract(isodow from timezone(${context.timezone}, created_at))::int as weekday,
        count(*)::int as operations, sum(total_cents)::bigint as sales_cents,
        count(distinct timezone(${context.timezone}, created_at)::date)::int as sale_days
      from sale where business_id = ${context.businessId} and status = 'COMPLETED'
        and timezone(${context.timezone}, created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
      group by weekday order by sales_cents desc
    `,
    sql`
      select case
          when extract(hour from timezone(${context.timezone}, created_at)) between 8 and 9 then '08–10'
          when extract(hour from timezone(${context.timezone}, created_at)) between 10 and 11 then '10–12'
          when extract(hour from timezone(${context.timezone}, created_at)) between 12 and 13 then '12–14'
          when extract(hour from timezone(${context.timezone}, created_at)) between 14 and 15 then '14–16'
          when extract(hour from timezone(${context.timezone}, created_at)) between 16 and 17 then '16–18'
          when extract(hour from timezone(${context.timezone}, created_at)) between 18 and 19 then '18–20'
          when extract(hour from timezone(${context.timezone}, created_at)) between 20 and 21 then '20–22'
          else 'Otros horarios' end as band,
        count(*)::int as operations, sum(total_cents)::bigint as sales_cents,
        count(distinct timezone(${context.timezone}, created_at)::date)::int as sale_days
      from sale where business_id = ${context.businessId} and status = 'COMPLETED'
        and timezone(${context.timezone}, created_at)::date between ${ranges.current.start}::date and ${ranges.current.end}::date
      group by band order by operations desc, sales_cents desc
    `,
  ]);
  if (!financial) return null;

  const products: IntelligentProduct[] = productRows.map((row) => {
    const salesCents = Number(row.period_sales);
    const cogsCents = Number(row.period_cogs);
    const grossMarginCents = salesCents - cogsCents;
    const currentStock = Number(row.current_stock);
    const minimumStock = Number(row.minimum_stock);
    const productAgeDays = Number(row.product_age_days);
    const unitsInVelocityWindow = Number(row.velocity_units);
    const dailyAverage = averageDailySales(unitsInVelocityWindow, safeInventoryDays);
    const coverage = estimatedStockDays(currentStock, dailyAverage);
    const immobilized = isImmobilized({ productAgeDays, unitsSoldLast60Days: Number(row.units_60), currentStock });
    return {
      productId: String(row.id), name: String(row.name), currentStock, minimumStock,
      currentCostCents: Number(row.cost_price_cents), productAgeDays, units: Number(row.period_units), salesCents, cogsCents,
      grossMarginCents, marginPercent: marginPercent(salesCents, grossMarginCents),
      unitsInVelocityWindow, averageDailySales: roundMetric(dailyAverage), estimatedDaysRemaining: coverage === null ? null : roundMetric(coverage),
      unitsLast60Days: Number(row.units_60), lastSale: row.last_sale ? String(row.last_sale) : null,
      reorderPriority: classifyReorder({ currentStock, minimumStock, estimatedDaysRemaining: coverage }),
      confidence: confidenceForHistory(Math.min(context.historyDays, productAgeDays)),
      slowMoving: isSlowMoving({ productAgeDays, unitsSold: Number(row.period_units), currentStock }), immobilized,
      immobilizedValueCents: immobilized ? currentStock * Number(row.cost_price_cents) : 0,
    };
  });

  const evolution: DailyEvolution[] = evolutionRows.map((row) => ({
    date: String(row.day), salesCents: Number(row.sales_cents), grossMarginCents: Number(row.gross_margin_cents),
    expensesCents: Number(row.expenses_cents), estimatedResultCents: Number(row.estimated_result_cents),
  }));
  const weekdays = weekdayRows.map((row) => ({
    weekday: WEEKDAYS[Number(row.weekday) - 1], operations: Number(row.operations), salesCents: Number(row.sales_cents), saleDays: Number(row.sale_days),
  }));
  const hours = hourRows.map((row) => ({ band: String(row.band), operations: Number(row.operations), salesCents: Number(row.sales_cents), saleDays: Number(row.sale_days) }));
  const distinctSaleDays = weekdays.reduce((total, row) => total + row.saleDays, 0);
  const patternSufficient = periodDays >= 14 && financial.current.operations >= 10 && distinctSaleDays >= 4;
  const calculatedAt = new Date().toISOString();
  const immobilizedProducts = products.filter((product) => product.immobilized).sort((a, b) => b.immobilizedValueCents - a.immobilizedValueCents);
  const reorderCandidates = products.filter((product) => product.reorderPriority !== "OK").sort((a, b) => {
    const priority = { URGENT: 0, SOON: 1, OK: 2 };
    return priority[a.reorderPriority] - priority[b.reorderPriority] || (a.estimatedDaysRemaining ?? Infinity) - (b.estimatedDaysRemaining ?? Infinity);
  });

  return {
    context: { timezone: context.timezone, today: context.today, historyDays: context.historyDays }, ranges, periodDays, inventoryDays: safeInventoryDays,
    financial, evolution, products,
    rankings: {
      byUnits: [...products].filter((item) => item.units > 0).sort((a, b) => b.units - a.units || b.salesCents - a.salesCents).slice(0, 5),
      byRevenue: [...products].filter((item) => item.units > 0).sort((a, b) => b.salesCents - a.salesCents || b.units - a.units).slice(0, 5),
      byProfitability: [...products].filter((item) => item.units > 0).sort((a, b) => b.grossMarginCents - a.grossMarginCents).slice(0, 5),
      lowestMargin: [...products].filter((item) => item.units > 0 && item.marginPercent !== null).sort((a, b) => (a.marginPercent ?? 0) - (b.marginPercent ?? 0)).slice(0, 5),
      slowMoving: products.filter((item) => item.slowMoving).sort((a, b) => a.units - b.units || b.currentStock - a.currentStock).slice(0, 10),
    },
    patterns: {
      sufficient: patternSufficient,
      reason: patternSufficient ? null : "Necesitamos al menos 14 días, 10 ventas y actividad en 4 días distintos para detectar patrones.",
      weekdays, hours, strongestDay: patternSufficient ? weekdays[0] ?? null : null, strongestHour: patternSufficient ? hours[0] ?? null : null,
      weakestHour: patternSufficient && hours.length > 1 ? hours[hours.length - 1] : null,
    },
    inventory: {
      products: [...products].sort((a, b) => {
        const priority = { URGENT: 0, SOON: 1, OK: 2 };
        return priority[a.reorderPriority] - priority[b.reorderPriority] || b.averageDailySales - a.averageDailySales;
      }),
      reorderCandidates, buyMoreCandidates: reorderCandidates.filter((item) => item.averageDailySales > 0),
      buyLessCandidates: immobilizedProducts, immobilizedProducts,
      immobilizedValueCents: immobilizedProducts.reduce((total, product) => total + product.immobilizedValueCents, 0),
    },
    insights: buildInsights({ products, salesComparison: financial.comparisons.sales, expensesComparison: financial.comparisons.expenses, calculatedAt }),
  };
}

export async function getDashboardDetectionsForUser(userId: string) {
  const context = await getAnalyticsContext(userId);
  if (!context) return null;
  const sql = getSqlClient();
  const rows = await sql`
    with recent as (
      select si.product_id,
        coalesce(sum(si.quantity) filter (where timezone(${context.timezone}, s.created_at)::date >= ${context.today}::date - 29), 0)::int as units_30,
        coalesce(sum(si.quantity), 0)::int as units_60
      from sale_item si inner join sale s on s.id = si.sale_id and s.business_id = si.business_id
      where s.business_id = ${context.businessId} and s.status = 'COMPLETED'
        and timezone(${context.timezone}, s.created_at)::date between ${context.today}::date - 59 and ${context.today}::date
      group by si.product_id
    )
    select p.name, p.current_stock, p.minimum_stock, p.cost_price_cents,
      greatest(1, ${context.today}::date - timezone(${context.timezone}, p.created_at)::date + 1)::int as age_days,
      coalesce(r.units_30, 0)::int as units_30, coalesce(r.units_60, 0)::int as units_60
    from product p left join recent r on r.product_id = p.id
    where p.business_id = ${context.businessId} and p.is_active = true
  `;
  let urgentCount = 0; let immobilizedValueCents = 0;
  for (const row of rows) {
    const coverage = estimatedStockDays(Number(row.current_stock), averageDailySales(Number(row.units_30), 30));
    if (classifyReorder({ currentStock: Number(row.current_stock), minimumStock: Number(row.minimum_stock), estimatedDaysRemaining: coverage }) === "URGENT") urgentCount += 1;
    if (isImmobilized({ productAgeDays: Number(row.age_days), unitsSoldLast60Days: Number(row.units_60), currentStock: Number(row.current_stock) })) {
      immobilizedValueCents += Number(row.current_stock) * Number(row.cost_price_cents);
    }
  }
  return { urgentCount, immobilizedValueCents };
}
