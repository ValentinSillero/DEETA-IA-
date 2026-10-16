import { buildAnalysisSummary } from "@/lib/analytics-presentation";

export type AiProductStatus =
  | "out_of_stock"
  | "low_stock"
  | "urgent_restock"
  | "restock_soon"
  | "slow_moving"
  | "excess_stock"
  | "sufficient_stock";

export type AiProductPresentationItem = {
  productName: string;
  currentStock?: number;
  minimumStock?: number;
  unitsSold?: number;
  periodDays?: number;
  sales?: string;
  cogs?: string;
  grossMargin?: string;
  marginPercent?: number | null;
  coverageDays?: number | null;
  lastSaleDate?: string | null;
  daysWithoutSales?: number | null;
  status?: AiProductStatus;
};

export type AiProductPresentation = {
  type: "product-list" | "product-highlight";
  variant: "stock" | "reorder" | "slow-moving" | "excess-stock" | "top-selling" | "least-selling" | "no-sales" | "top-revenue" | "least-revenue" | "top-margin" | "top-margin-percent" | "low-margin";
  title: string;
  summary?: string;
  periodLabel?: string;
  note?: string;
  items: AiProductPresentationItem[];
};

export type AiBusinessOverviewMetric = {
  type: "sales" | "gross-margin" | "expenses" | "estimated-result" | "inventory";
  title: string;
  value: string;
  change?: string;
  explanation: string;
  tone: "positive" | "attention" | "neutral";
};

export type AiBusinessOverviewPresentation = {
  type: "business-overview";
  title: string;
  summary: string;
  metrics: AiBusinessOverviewMetric[];
  highlightedProduct?: {
    title: string;
    productName: string;
    valueLabel: string;
    value: string;
    secondary?: string;
  };
  recommendations: string[];
  periodLabel: string;
};

export type AiMetricPresentation = {
  type: "metric";
  title: string;
  value: string;
  comparison?: string;
  explanation: string;
  details: Array<{ label: string; value: string }>;
  periodLabel?: string;
};

export type AiExpenseBreakdownPresentation = {
  type: "expense-breakdown";
  title: string;
  total: string;
  comparison?: string;
  difference?: string;
  periodLabel: string;
  categories: Array<{
    name: string;
    amount: string;
    previousAmount: string;
    difference: string;
    percentageDifference?: number | null;
  }>;
};

export type AiCustomerListPresentation = {
  type: "customer-list";
  title: string;
  summary: string;
  items: Array<{ name: string; balance: string; detail: string }>;
  note?: string;
};

export type AiPresentation = AiProductPresentation | AiBusinessOverviewPresentation | AiMetricPresentation | AiExpenseBreakdownPresentation | AiCustomerListPresentation;

type ToolEvidence = { tool?: unknown; data?: unknown };
type UnknownRecord = Record<string, unknown>;

const PRODUCT_PRESENTATION_TYPES = new Set(["product-list", "product-highlight"]);
const PRESENTATION_VARIANTS = new Set(["stock", "reorder", "slow-moving", "excess-stock", "top-selling", "least-selling", "no-sales", "top-revenue", "least-revenue", "top-margin", "top-margin-percent", "low-margin"]);
const PRODUCT_STATUSES = new Set<AiProductStatus>([
  "out_of_stock",
  "low_stock",
  "urgent_restock",
  "restock_soon",
  "slow_moving",
  "excess_stock",
  "sufficient_stock",
]);

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record).filter((item): item is UnknownRecord => item !== null) : [];
}

function periodLabel(data: UnknownRecord) {
  return text(record(data.period)?.label);
}

function formatPercentage(value: number) {
  return `${Math.abs(value).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function formatMoneyCents(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 2 }).format(value / 100);
}

function comparisonText(value: number | undefined) {
  if (value === undefined) return "Sin comparación disponible";
  if (value === 0) return "Sin cambios frente al período anterior";
  return `${formatPercentage(value)} ${value > 0 ? "más" : "menos"} que el período anterior`;
}

function comparisonExplanation(subject: "sales" | "expenses", value: number | undefined) {
  if (value === undefined) return "Todavía no hay datos anteriores suficientes para comparar.";
  if (value === 0) return subject === "sales" ? "Las ventas se mantuvieron estables." : "Los gastos se mantuvieron estables.";
  if (subject === "sales") return value > 0 ? "Vendiste más que en el período anterior." : "Vendiste menos que en el período anterior.";
  return value > 0 ? "Registraste más gastos que en el período anterior." : "Registraste menos gastos que en el período anterior.";
}

function formatPeriod(data: UnknownRecord) {
  const period = record(data.period);
  const start = text(period?.start);
  const end = text(period?.end);
  if (!start || !end) return periodLabel(data) ?? "Período consultado";
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return periodLabel(data) ?? "Período consultado";
  const month = new Intl.DateTimeFormat("es-UY", { month: "short", timeZone: "UTC" }).format(endDate).replace(".", "").toLocaleLowerCase("es");
  const year = endDate.getUTCFullYear();
  if (start === end) return `${startDate.getUTCDate()} ${month} ${year}`;
  if (startDate.getUTCMonth() === endDate.getUTCMonth() && startDate.getUTCFullYear() === year) {
    return `${startDate.getUTCDate()}–${endDate.getUTCDate()} ${month} ${year}`;
  }
  const startMonth = new Intl.DateTimeFormat("es-UY", { month: "short", timeZone: "UTC" }).format(startDate).replace(".", "").toLocaleLowerCase("es");
  const startYear = startDate.getUTCFullYear() === year ? "" : ` ${startDate.getUTCFullYear()}`;
  return `${startDate.getUTCDate()} ${startMonth}${startYear}–${endDate.getUTCDate()} ${month} ${year}`;
}

function isBusinessOverviewQuestion(question: string) {
  return /(?:analiz|an[aá]lisis).*(?:negocio)|an[aá]lisis completo|(?:c[oó]mo|qu[eé] tal|qu[eé] pas[oó]).*(?:negocio)|qu[eé].*(?:deber[ií]a|conviene).*(?:mejorar|revisar)/i.test(question);
}

function overviewRecommendations(values: {
  salesChange?: number;
  grossMarginChange?: number;
  expensesChange?: number;
  resultChange?: number;
  estimatedResultCents?: number;
}) {
  const recommendations: string[] = [];
  if (values.expensesChange !== undefined && values.expensesChange > 0 && (values.salesChange === undefined || values.expensesChange > values.salesChange)) {
    recommendations.push("Revisar qué gastos aumentaron más que las ventas.");
  }
  if (values.estimatedResultCents !== undefined && values.estimatedResultCents < 0) {
    recommendations.push("Revisar costos y gastos porque el resultado estimado fue negativo.");
  } else if (values.resultChange !== undefined && values.resultChange < 0) {
    recommendations.push("Analizar por qué el resultado fue menor que en el período anterior.");
  }
  if (values.grossMarginChange !== undefined && values.grossMarginChange < 0) {
    recommendations.push("Revisar los productos cuyo margen se redujo.");
  }
  if (values.salesChange !== undefined && values.salesChange < 0) {
    recommendations.push("Revisar qué productos explican la baja de ventas.");
  }
  return recommendations.slice(0, 3);
}

function optionalInventoryOverview(evidence: unknown[]) {
  const entry = evidence.find((value) => text((record(value) as ToolEvidence | null)?.tool) === "get_inventory_analysis");
  const data = record((record(entry) as ToolEvidence | null)?.data);
  if (!data) return null;
  const products = records(data.products);
  if (products.length === 0) return null;
  const focus = text(data.focus);
  if (focus === "REORDER" || focus === "LOW_STOCK") return {
    metric: { type: "inventory" as const, title: "Inventario", value: productCount(products.length), explanation: "Necesitan atención por su nivel de stock o su ritmo reciente de venta.", tone: "attention" as const },
    recommendation: "Reponer primero los productos que necesitan atención de stock.",
  };
  if (focus === "SLOW" || focus === "EXCESS") return {
    metric: { type: "inventory" as const, title: "Inventario", value: productCount(products.length), explanation: "Tienen baja rotación o mucho stock para su ritmo de venta.", tone: "attention" as const },
    recommendation: "Revisar los productos con baja rotación o exceso de stock.",
  };
  return null;
}

function optionalHighlightedProduct(evidence: unknown[]): AiBusinessOverviewPresentation["highlightedProduct"] {
  const businessEntry = evidence.find((value) => text((record(value) as ToolEvidence | null)?.tool) === "get_business_period_analysis");
  const businessProducts = record(record((record(businessEntry) as ToolEvidence | null)?.data)?.products);
  const businessProfitable = record(businessProducts?.highestGrossMargin);
  if (businessProfitable && text(businessProfitable.productName) && text(businessProfitable.grossMargin)) return {
    title: "Producto con mayor margen",
    productName: text(businessProfitable.productName)!,
    valueLabel: "Margen bruto",
    value: text(businessProfitable.grossMargin)!,
    secondary: number(businessProfitable.unitsSold) !== undefined ? `${number(businessProfitable.unitsSold)!.toLocaleString("es-AR")} unidades vendidas` : undefined,
  };
  const profitabilityEntry = evidence.find((value) => text((record(value) as ToolEvidence | null)?.tool) === "getProductProfitability");
  const profitabilityData = record((record(profitabilityEntry) as ToolEvidence | null)?.data);
  const profitable = records(profitabilityData?.mostProfitable)[0];
  if (profitable && text(profitable.name) && text(profitable.grossMargin)) return {
    title: "Producto con mayor margen",
    productName: text(profitable.name)!,
    valueLabel: "Margen bruto",
    value: text(profitable.grossMargin)!,
    secondary: number(profitable.units) !== undefined ? `${number(profitable.units)!.toLocaleString("es-AR")} unidades vendidas` : undefined,
  };
  const topEntry = evidence.find((value) => text((record(value) as ToolEvidence | null)?.tool) === "get_top_product_analysis");
  const topData = record((record(topEntry) as ToolEvidence | null)?.data);
  const current = record(topData?.current);
  if (topData && current && text(topData.product) && text(current.grossMargin)) return {
    title: "Producto destacado",
    productName: text(topData.product)!,
    valueLabel: "Margen bruto",
    value: text(current.grossMargin)!,
    secondary: number(current.units) !== undefined ? `${number(current.units)!.toLocaleString("es-AR")} unidades vendidas` : undefined,
  };
  return undefined;
}

function businessOverviewPresentation(data: UnknownRecord, evidence: unknown[]): AiBusinessOverviewPresentation | undefined {
  const comparisons = record(data.comparisonsPercent);
  const sales = text(data.sales);
  const grossMargin = text(data.grossMargin);
  const expenses = text(data.expenses);
  const estimatedResult = text(data.estimatedResult);
  if (!sales || !grossMargin || !expenses || !estimatedResult) return undefined;
  const salesChange = number(comparisons?.sales);
  const grossMarginChange = number(comparisons?.grossMargin);
  const expensesChange = number(comparisons?.expenses);
  const resultChange = number(comparisons?.estimatedResult);
  const grossMarginCents = number(data.grossMarginCents) ?? 0;
  const expensesCents = number(data.expensesCents) ?? 0;
  const estimatedResultCents = number(data.estimatedResultCents) ?? 0;
  const operations = number(data.operations) ?? 0;
  const summary = buildAnalysisSummary({
    operations,
    grossMarginCents,
    expensesCents,
    estimatedResultCents,
    comparisons: { sales: salesChange ?? null, expenses: expensesChange ?? null, estimatedResult: resultChange ?? null },
  })[0] ?? "Este es el resumen del período consultado.";
  const inventory = optionalInventoryOverview(evidence);
  const financialRecommendations = overviewRecommendations({ salesChange, grossMarginChange, expensesChange, resultChange, estimatedResultCents });
  return {
    type: "business-overview",
    title: "Resumen del negocio",
    summary,
    metrics: [
      {
        type: "sales",
        title: "Ventas",
        value: sales,
        change: comparisonText(salesChange),
        explanation: comparisonExplanation("sales", salesChange),
        tone: salesChange !== undefined && salesChange > 0 ? "positive" : salesChange !== undefined && salesChange < 0 ? "attention" : "neutral",
      },
      {
        type: "gross-margin",
        title: "Margen bruto",
        value: grossMargin,
        change: comparisonText(grossMarginChange),
        explanation: "Es lo que quedó de las ventas después de descontar el costo de los productos vendidos.",
        tone: grossMarginChange !== undefined && grossMarginChange < 0 ? "attention" : "neutral",
      },
      {
        type: "expenses",
        title: "Gastos",
        value: expenses,
        change: comparisonText(expensesChange),
        explanation: comparisonExplanation("expenses", expensesChange),
        tone: expensesChange !== undefined && expensesChange > 0 ? "attention" : "neutral",
      },
      {
        type: "estimated-result",
        title: "Resultado estimado",
        value: estimatedResult,
        change: comparisonText(resultChange),
        explanation: estimatedResultCents < 0
          ? "Después de costos y gastos registrados, el resultado estimado fue negativo."
          : "Es aproximadamente lo que quedó después de costos y gastos registrados.",
        tone: estimatedResultCents < 0 || (resultChange !== undefined && resultChange < 0) ? "attention" : estimatedResultCents > 0 ? "positive" : "neutral",
      },
      ...(inventory ? [inventory.metric] : []),
    ],
    highlightedProduct: optionalHighlightedProduct(evidence),
    recommendations: [...(inventory ? [inventory.recommendation] : []), ...financialRecommendations].slice(0, 3),
    periodLabel: formatPeriod(data),
  };
}

function productCount(count: number) {
  return `${count} ${count === 1 ? "producto" : "productos"}`;
}

function inventorySummary(focus: string, items: AiProductPresentationItem[]) {
  const count = productCount(items.length);
  if (focus === "REORDER") return items.length === 1 ? "Este es el producto que más conviene reponer." : `Estos son los ${count} que más conviene reponer.`;
  if (focus === "SLOW") return `Encontré ${count} con baja rotación.`;
  if (focus === "EXCESS") return `Encontré ${count} con mucho stock para su ritmo de venta.`;
  const withoutStock = items.filter((item) => item.status === "out_of_stock").length;
  if (withoutStock === items.length) return `Tenés ${productCount(withoutStock)} sin stock. Estos son los que conviene revisar primero.`;
  if (withoutStock > 0) return `Encontré ${count} con stock bajo o agotado.`;
  return items.length === 1 ? "Este es el producto con menor stock actualmente." : `Estos son los ${count} con menor stock actualmente.`;
}

function inventoryStatus(item: UnknownRecord, focus: string): AiProductStatus {
  const currentStock = number(item.currentStock);
  const minimumStock = number(item.minimumStock);
  const priority = text(item.priority);
  if (currentStock === 0) return "out_of_stock";
  if (focus === "SLOW") return "slow_moving";
  if (focus === "EXCESS") return "excess_stock";
  if (priority === "URGENT") return "urgent_restock";
  if (currentStock !== undefined && minimumStock !== undefined && currentStock <= minimumStock) return "low_stock";
  if (priority === "SOON") return "restock_soon";
  return "sufficient_stock";
}

function inventoryPresentation(data: UnknownRecord): AiProductPresentation | undefined {
  const focus = text(data.focus) ?? "LOW_STOCK";
  const days = number(data.days) ?? 30;
  const items = records(data.products).flatMap((item): AiProductPresentationItem[] => {
    const productName = text(item.name);
    if (!productName) return [];
    return [{
      productName,
      currentStock: number(item.currentStock),
      minimumStock: number(item.minimumStock),
      unitsSold: number(item.unitsSold) ?? number(item.unitsSoldLast30Days),
      periodDays: days,
      coverageDays: number(item.estimatedDaysRemaining) ?? null,
      status: inventoryStatus(item, focus),
    }];
  });
  if (items.length === 0) return undefined;
  const configuration = {
    REORDER: { variant: "reorder", title: "Productos para reponer" },
    SLOW: { variant: "slow-moving", title: "Productos con baja rotación" },
    EXCESS: { variant: "excess-stock", title: "Productos con mucho stock" },
    LOW_STOCK: { variant: "stock", title: "Productos con stock bajo" },
    LOWEST_STOCK: { variant: "stock", title: "Productos con menor stock" },
    OUT_OF_STOCK: { variant: "stock", title: "Productos sin stock" },
    BELOW_MINIMUM: { variant: "stock", title: "Productos debajo del stock mínimo" },
  }[focus] ?? { variant: "stock", title: "Estado de productos" };
  return {
    type: "product-list",
    variant: configuration.variant as AiProductPresentation["variant"],
    title: configuration.title,
    summary: inventorySummary(focus, items),
    note: focus === "REORDER" || focus === "SLOW" || focus === "EXCESS" ? `Período de ventas analizado: últimos ${days} días.` : undefined,
    items,
  };
}

function topProductPresentation(data: UnknownRecord, question: string): AiProductPresentation | undefined {
  const productName = text(data.product);
  const current = record(data.current);
  if (!productName || !current) return undefined;
  const asksForMargin = /margen|rentab|gan(?:o|é|e)/i.test(question);
  const selectedPeriod = periodLabel(data);
  return {
    type: "product-highlight",
    variant: asksForMargin ? "top-margin" : "top-selling",
    title: asksForMargin ? "Margen del producto más vendido" : "Producto más vendido",
    summary: asksForMargin
      ? `Este es el margen del producto más vendido${selectedPeriod ? ` ${selectedPeriod}` : ""}.`
      : `Este es el producto más vendido${selectedPeriod ? ` ${selectedPeriod}` : ""}.`,
    periodLabel: selectedPeriod,
    note: asksForMargin ? "El margen usa el precio y el costo guardados en cada venta." : undefined,
    items: [asksForMargin
      ? { productName, grossMargin: text(current.grossMargin), unitsSold: number(current.units) }
      : { productName, unitsSold: number(current.units), sales: text(current.sales), currentStock: number(current.currentStock), minimumStock: number(current.minimumStock) }],
  };
}

function profitableProductPresentation(data: UnknownRecord, question: string): AiProductPresentation | undefined {
  const asksForLowest = /(?:menos|menor|poco) margen/i.test(question);
  const asksForPercentage = /porcentaje.{0,12}margen|margen.{0,12}porcentaje/i.test(question);
  const product = records(asksForLowest ? data.lowestMargin : asksForPercentage ? data.highestMarginPercent : data.mostProfitable)[0];
  const productName = product ? text(product.name) : undefined;
  if (!product || !productName) return undefined;
  const selectedPeriod = periodLabel(data);
  return {
    type: "product-highlight",
    variant: asksForLowest ? "low-margin" : asksForPercentage ? "top-margin-percent" : "top-margin",
    title: asksForLowest ? "Producto con menor porcentaje de margen" : asksForPercentage ? "Producto con mayor porcentaje de margen" : "Producto con mayor margen",
    summary: asksForLowest
      ? `Este es el producto con menor porcentaje de margen${selectedPeriod ? ` ${selectedPeriod}` : ""}.`
      : asksForPercentage
        ? `Este es el producto con mayor porcentaje de margen${selectedPeriod ? ` ${selectedPeriod}` : ""}.`
        : `Este es el producto que generó más margen${selectedPeriod ? ` ${selectedPeriod}` : ""}.`,
    periodLabel: selectedPeriod,
    note: `${selectedPeriod ? `Basado en las ventas registradas durante ${selectedPeriod}. ` : ""}El margen usa el precio y el costo guardados en cada venta.`,
    items: [{
      productName,
      sales: text(product.revenue),
      cogs: text(product.cogs),
      grossMargin: text(product.grossMargin),
      marginPercent: number(product.marginPercent) ?? null,
      unitsSold: number(product.units),
    }],
  };
}

function periodMetricPresentation(data: UnknownRecord, question: string): AiMetricPresentation | undefined {
  const comparisons = record(data.comparisonsPercent);
  const previous = record(data.previous);
  const period = formatPeriod(data);
  const lower = question.toLocaleLowerCase("es");
  if (/cu[aá]ntas ventas|operaciones/.test(lower)) {
    const operations = number(data.operations);
    if (operations === undefined) return undefined;
    return {
      type: "metric", title: "Cantidad de ventas", value: operations.toLocaleString("es-AR"),
      comparison: comparisonText(number(comparisons?.operations)),
      explanation: "Es la cantidad de operaciones registradas, no la cantidad de unidades vendidas.",
      details: previous && number(previous.operations) !== undefined ? [{ label: "Período anterior", value: number(previous.operations)!.toLocaleString("es-AR") }] : [],
      periodLabel: period,
    };
  }
  if (/promedio por venta|ticket (?:medio|promedio)/.test(lower)) {
    const averageTicket = text(data.averageTicket);
    if (!averageTicket) return undefined;
    return {
      type: "metric", title: "Promedio por venta", value: averageTicket,
      comparison: comparisonText(number(comparisons?.averageTicket)),
      explanation: "Es el importe promedio de cada venta registrada durante el período.",
      details: previous && text(previous.averageTicket) ? [{ label: "Período anterior", value: text(previous.averageTicket)! }] : [],
      periodLabel: period,
    };
  }
  if (/margen/.test(lower)) {
    const grossMargin = text(data.grossMargin);
    if (!grossMargin) return undefined;
    return {
      type: "metric", title: "Margen bruto", value: grossMargin,
      comparison: comparisonText(number(comparisons?.grossMargin)),
      explanation: "Es lo que quedó de las ventas después de descontar el costo histórico de los productos vendidos.",
      details: text(data.costOfGoodsSold) ? [{ label: "Costo de productos vendidos", value: text(data.costOfGoodsSold)! }] : [],
      periodLabel: period,
    };
  }
  if (/ganando|ganancia|resultado/.test(lower)) {
    const result = text(data.estimatedResult);
    if (!result) return undefined;
    return {
      type: "metric", title: "Resultado estimado", value: result,
      comparison: comparisonText(number(comparisons?.estimatedResult)),
      explanation: "Es el margen bruto menos los gastos registrados; no reemplaza un resultado contable formal.",
      details: [
        ...(text(data.grossMargin) ? [{ label: "Margen bruto", value: text(data.grossMargin)! }] : []),
        ...(text(data.expenses) ? [{ label: "Gastos", value: text(data.expenses)! }] : []),
      ],
      periodLabel: period,
    };
  }
  const sales = text(data.sales);
  if (!sales) return undefined;
  return {
    type: "metric", title: "Ventas", value: sales,
    comparison: comparisonText(number(comparisons?.sales)),
    explanation: "Es todo lo que vendiste durante este período.",
    details: [
      ...(number(data.operations) !== undefined ? [{ label: "Cantidad de ventas", value: number(data.operations)!.toLocaleString("es-AR") }] : []),
      ...(text(data.averageTicket) ? [{ label: "Promedio por venta", value: text(data.averageTicket)! }] : []),
    ],
    periodLabel: period,
  };
}

function expenseBreakdownPresentation(data: UnknownRecord): AiExpenseBreakdownPresentation | undefined {
  const total = text(data.total);
  const selectedPeriod = periodLabel(data);
  if (!total || !selectedPeriod) return undefined;
  const categories = records(data.categories).flatMap((category): AiExpenseBreakdownPresentation["categories"] => {
    const name = text(category.name);
    const amount = text(category.amount);
    const previousAmount = text(category.previousAmount);
    const difference = text(category.difference);
    if (!name || !amount || !previousAmount || !difference) return [];
    return [{ name, amount, previousAmount, difference, percentageDifference: number(category.percentageDifference) ?? null }];
  });
  return {
    type: "expense-breakdown",
    title: "Gastos por categoría",
    total,
    comparison: comparisonText(number(data.comparisonPercent)),
    difference: text(data.difference),
    periodLabel: selectedPeriod,
    categories,
  };
}

function cashMetricPresentation(data: UnknownRecord): AiMetricPresentation | undefined {
  if (data.status === "OPEN") {
    const expectedCash = text(data.expectedCash);
    if (!expectedCash) return undefined;
    return {
      type: "metric", title: "Efectivo esperado en caja", value: expectedCash,
      explanation: "Incluye el monto inicial, las ventas en efectivo y los gastos en efectivo registrados en esta caja.",
      details: [
        ...(text(data.openingAmount) ? [{ label: "Monto inicial", value: text(data.openingAmount)! }] : []),
        ...(text(data.cashSales) ? [{ label: "Ventas en efectivo", value: text(data.cashSales)! }] : []),
        ...(text(data.cashExpenses) ? [{ label: "Gastos en efectivo", value: text(data.cashExpenses)! }] : []),
      ],
    };
  }
  const latestClosed = record(data.latestClosed);
  if (!latestClosed || !text(latestClosed.difference)) return undefined;
  return {
    type: "metric", title: "Diferencia de la última caja", value: text(latestClosed.difference)!,
    explanation: "Es la diferencia entre el efectivo declarado y el efectivo esperado al cerrar la caja.",
    details: [
      ...(text(latestClosed.expectedCash) ? [{ label: "Efectivo esperado", value: text(latestClosed.expectedCash)! }] : []),
      ...(text(latestClosed.declaredCash) ? [{ label: "Efectivo declarado", value: text(latestClosed.declaredCash)! }] : []),
    ],
  };
}

function salesPatternPresentation(data: UnknownRecord): AiMetricPresentation | undefined {
  if (data.sufficientData !== true) return undefined;
  const focus = text(data.focus);
  const strongest = record(data.strongest);
  if (!strongest) return undefined;
  if (focus === "DAYS" && text(strongest.weekday)) {
    return {
      type: "metric", title: "Día con más ventas", value: text(strongest.weekday)!,
      explanation: "Es el día de la semana con mayor actividad dentro del período analizado.",
      details: [
        ...(number(strongest.operations) !== undefined ? [{ label: "Cantidad de ventas", value: number(strongest.operations)!.toLocaleString("es-AR") }] : []),
        ...(number(strongest.salesCents) !== undefined ? [{ label: "Ventas", value: formatMoneyCents(number(strongest.salesCents)!) }] : []),
      ],
      periodLabel: formatPeriod(data),
    };
  }
  if (focus === "HOURS" && text(strongest.band)) {
    return {
      type: "metric", title: "Horario con más ventas", value: text(strongest.band)!,
      explanation: "Es la franja horaria con mayor actividad dentro del período analizado.",
      details: [
        ...(number(strongest.operations) !== undefined ? [{ label: "Cantidad de ventas", value: number(strongest.operations)!.toLocaleString("es-AR") }] : []),
        ...(number(strongest.salesCents) !== undefined ? [{ label: "Ventas", value: formatMoneyCents(number(strongest.salesCents)!) }] : []),
      ],
      periodLabel: formatPeriod(data),
    };
  }
  return undefined;
}

function productSalesRankingPresentation(data: UnknownRecord): AiProductPresentation | undefined {
  const ranking = text(data.ranking);
  const selectedPeriod = periodLabel(data);
  const configuration = {
    MOST_UNITS: { variant: "top-selling", title: "Productos más vendidos", singularTitle: "Producto más vendido" },
    LEAST_UNITS: { variant: "least-selling", title: "Productos menos vendidos", singularTitle: "Producto menos vendido" },
    MOST_REVENUE: { variant: "top-revenue", title: "Productos con mayor facturación", singularTitle: "Producto con mayor facturación" },
    LEAST_REVENUE: { variant: "least-revenue", title: "Productos con menor facturación", singularTitle: "Producto con menor facturación" },
    NO_SALES: { variant: "no-sales", title: "Productos sin ventas", singularTitle: "Producto sin ventas" },
  }[ranking ?? ""];
  if (!configuration) return undefined;
  const items = records(data.products).flatMap((product): AiProductPresentationItem[] => {
    const productName = text(product.productName);
    if (!productName || number(product.unitsSold) === undefined || number(product.currentStock) === undefined || !text(product.revenue)) return [];
    return [{
      productName,
      unitsSold: number(product.unitsSold),
      sales: text(product.revenue),
      cogs: text(product.cogs),
      grossMargin: text(product.grossMargin),
      marginPercent: number(product.marginPercent) ?? null,
      currentStock: number(product.currentStock),
      lastSaleDate: product.lastSaleDate === null ? null : text(product.lastSaleDate),
      daysWithoutSales: product.daysWithoutSales === null ? null : number(product.daysWithoutSales),
    }];
  });
  if (items.length === 0) return undefined;
  const title = items.length === 1 ? configuration.singularTitle : configuration.title;
  return {
    type: items.length === 1 ? "product-highlight" : "product-list",
    variant: configuration.variant as AiProductPresentation["variant"],
    title,
    periodLabel: selectedPeriod,
    items,
  };
}

function productPerformancePresentation(data: UnknownRecord, question: string): AiProductPresentation | undefined {
  const product = records(data.matches)[0];
  const productName = product ? text(product.name) : undefined;
  if (!product || !productName) return undefined;
  const asksForMargin = /margen|rentab|gan(?:o|é|e)/i.test(question);
  return {
    type: "product-highlight",
    variant: asksForMargin ? "top-margin" : "top-selling",
    title: "Producto consultado",
    periodLabel: periodLabel(data),
    note: asksForMargin ? "El margen usa el precio y el costo guardados en cada venta." : undefined,
    items: [{
      productName,
      unitsSold: number(product.units),
      sales: text(product.sales),
      cogs: text(product.cogs),
      grossMargin: text(product.grossMargin),
      marginPercent: number(product.marginPercent) ?? null,
      currentStock: number(product.currentStock),
      minimumStock: number(product.minimumStock),
      lastSaleDate: product.lastSale === null ? null : text(product.lastSale),
    }],
  };
}

function customerBalancesPresentation(data: UnknownRecord): AiPresentation | undefined {
  const total = text(data.totalPending);
  const debtors = number(data.debtors);
  if (!total || debtors === undefined) return undefined;
  const items = records(data.customers).flatMap((customer) => {
    const name = text(customer.name);
    const balance = text(customer.balance);
    if (!name || !balance) return [];
    const days = number(customer.daysWithoutPayment);
    const detail = data.focus === "OLDEST_UNPAID"
      ? (text(customer.lastPaymentDate) ? `Último pago: ${text(customer.lastPaymentDate)}` : "Todavía no registró pagos") + (days !== undefined ? ` · hace ${days} ${days === 1 ? "día" : "días"}` : "")
      : `Último movimiento: ${text(customer.lastMovementDate) ?? "sin registro"}`;
    return [{ name, balance, detail }];
  });
  if (debtors === 0) {
    return { type: "metric", title: "Te deben", value: total, explanation: "Ningún cliente tiene deuda pendiente: todos están al día.", details: [] };
  }
  const titles: Record<string, string> = { DEBTORS: "Clientes con deuda", TOP_DEBTOR: "Quién te debe más", OLDEST_UNPAID: "Quién hace más tiempo que no paga" };
  return {
    type: "customer-list",
    title: titles[String(data.focus)] ?? "Clientes con deuda",
    summary: `Te deben ${total} entre ${debtors} ${debtors === 1 ? "cliente" : "clientes"}.`,
    items: items.slice(0, 8),
    note: "Saldos según las ventas fiadas y los pagos registrados en DEETA.",
  };
}

function customerAccountPresentation(data: UnknownRecord): AiPresentation | undefined {
  const customer = record(data.customer);
  if (!customer) {
    return { type: "metric", title: "Cliente no encontrado", value: text(data.customerReference) ?? "—", explanation: "No encontramos un cliente con ese nombre en tu negocio. Revisá cómo está cargado en Clientes.", details: [] };
  }
  const name = text(customer.name);
  const balance = text(customer.balance);
  if (!name || !balance) return undefined;
  const pending = records(customer.pendingPurchases).flatMap((purchase) => {
    const amount = text(purchase.amount);
    if (!amount) return [];
    return [{ label: `Venta fiada · ${text(purchase.date) ?? ""}${text(purchase.items) ? ` · ${text(purchase.items)}` : ""}`, value: amount }];
  });
  const lastPayment = record(customer.lastPayment);
  const owes = (number(customer.balanceCents) ?? 0) > 0;
  return {
    type: "metric",
    title: owes ? `${name} debe` : `${name} está al día`,
    value: balance,
    explanation: owes
      ? "Compras fiadas desde la última vez que estuvo al día. Los pagos se descuentan del total, no de una compra en particular."
      : "No tiene deuda pendiente.",
    details: [
      ...(lastPayment && text(lastPayment.date) ? [{ label: "Último pago", value: `${text(lastPayment.amount)} · ${text(lastPayment.date)}` }] : []),
      ...pending,
    ],
  };
}

function customerPaymentsPresentation(data: UnknownRecord): AiPresentation | undefined {
  const total = text(data.total);
  const selectedPeriod = periodLabel(data);
  if (!total || !selectedPeriod) return undefined;
  return {
    type: "metric",
    title: "Pagos de fiado recibidos",
    value: total,
    periodLabel: selectedPeriod,
    explanation: "Lo que pagaron tus clientes a cuenta de su deuda. Las ventas fiadas ya se contaron como ventas el día que se hicieron.",
    details: records(data.byMethod).flatMap((method) => text(method.method) && text(method.amount) ? [{ label: text(method.method)!, value: text(method.amount)! }] : []),
  };
}

export function buildAiPresentation(evidence: unknown[], question: string): AiPresentation | undefined {
  if (isBusinessOverviewQuestion(question)) {
    const summaryEvidence = evidence.find((value) => ["get_business_period_analysis", "get_period_summary"].includes(text((record(value) as ToolEvidence | null)?.tool) ?? ""));
    const summaryData = record((record(summaryEvidence) as ToolEvidence | null)?.data);
    if (summaryData) {
      const nestedInventory = record(summaryData.inventory);
      const enrichedEvidence = nestedInventory && Array.isArray(nestedInventory.reorder)
        ? [...evidence, { tool: "get_inventory_analysis", data: { focus: "REORDER", days: 30, products: nestedInventory.reorder } }]
        : evidence;
      return businessOverviewPresentation(summaryData, enrichedEvidence);
    }
  }
  for (const value of evidence) {
    const entry = record(value) as ToolEvidence | null;
    const tool = text(entry?.tool);
    const data = record(entry?.data);
    if (!tool || !data) continue;
    if (tool === "get_inventory_analysis") return inventoryPresentation(data);
    if (tool === "get_product_sales_ranking") return productSalesRankingPresentation(data);
    if (tool === "get_top_product_analysis") return topProductPresentation(data, question);
    if (tool === "getProductProfitability") return profitableProductPresentation(data, question);
    if (tool === "get_product_performance") return productPerformancePresentation(data, question);
    if (tool === "get_expense_breakdown") return expenseBreakdownPresentation(data);
    if (tool === "get_cash_summary") return cashMetricPresentation(data);
    if (tool === "get_customer_balances") return customerBalancesPresentation(data);
    if (tool === "get_customer_account") return customerAccountPresentation(data);
    if (tool === "get_customer_payments") return customerPaymentsPresentation(data);
    if (tool === "get_sales_patterns") return salesPatternPresentation(data);
    if (tool === "get_period_summary" && !/(?:por qu[eé]|explicame|explic[aá])/.test(question.toLocaleLowerCase("es"))) return periodMetricPresentation(data, question);
  }
  return undefined;
}

export function isAiPresentation(value: unknown): value is AiPresentation {
  const candidate = record(value);
  if (!candidate || !text(candidate.title)) return false;
  if (candidate.type === "business-overview") {
    if (!text(candidate.summary) || !text(candidate.periodLabel)) return false;
    const metrics = records(candidate.metrics);
    const recommendations = Array.isArray(candidate.recommendations) ? candidate.recommendations : [];
    if (metrics.length === 0 || metrics.length > 6 || recommendations.length > 3 || !recommendations.every((item) => typeof item === "string")) return false;
    return metrics.every((metric) => text(metric.type) && text(metric.title) && text(metric.value) && text(metric.explanation)
      && ["positive", "attention", "neutral"].includes(String(metric.tone))
      && (metric.change === undefined || typeof metric.change === "string"));
  }
  if (candidate.type === "metric") {
    if (!text(candidate.value) || !text(candidate.explanation) || !Array.isArray(candidate.details)) return false;
    return records(candidate.details).every((detail) => text(detail.label) && text(detail.value));
  }
  if (candidate.type === "customer-list") {
    if (!text(candidate.summary) || !Array.isArray(candidate.items)) return false;
    const items = records(candidate.items);
    return items.length <= 8 && items.every((item) => text(item.name) && text(item.balance) && text(item.detail));
  }
  if (candidate.type === "expense-breakdown") {
    if (!text(candidate.total) || !text(candidate.periodLabel) || !Array.isArray(candidate.categories)) return false;
    return records(candidate.categories).every((category) => text(category.name) && text(category.amount)
      && text(category.previousAmount) && text(category.difference)
      && (category.percentageDifference === undefined || category.percentageDifference === null || number(category.percentageDifference) !== undefined));
  }
  if (!PRODUCT_PRESENTATION_TYPES.has(String(candidate.type)) || !PRESENTATION_VARIANTS.has(String(candidate.variant))) return false;
  if (candidate.summary !== undefined && typeof candidate.summary !== "string") return false;
  if (candidate.periodLabel !== undefined && typeof candidate.periodLabel !== "string") return false;
  if (candidate.note !== undefined && typeof candidate.note !== "string") return false;
  const items = records(candidate.items);
  if (items.length === 0 || items.length > 8) return false;
  return items.every((item) => {
    if (!text(item.productName)) return false;
    if (item.status !== undefined && !PRODUCT_STATUSES.has(item.status as AiProductStatus)) return false;
    if ([item.currentStock, item.minimumStock, item.unitsSold, item.periodDays].some((value) => value !== undefined && number(value) === undefined)) return false;
    if (item.coverageDays !== undefined && item.coverageDays !== null && number(item.coverageDays) === undefined) return false;
    if ([item.marginPercent, item.daysWithoutSales].some((value) => value !== undefined && value !== null && number(value) === undefined)) return false;
    if (item.lastSaleDate !== undefined && item.lastSaleDate !== null && typeof item.lastSaleDate !== "string") return false;
    return [item.sales, item.cogs, item.grossMargin].every((value) => value === undefined || typeof value === "string");
  });
}
