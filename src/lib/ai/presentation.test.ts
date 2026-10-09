import { describe, expect, it } from "vitest";

import { buildAiPresentation } from "@/lib/ai/presentation";

describe("presentación estructurada de DEETA AI", () => {
  const businessEvidence = [{
    tool: "get_period_summary",
    data: {
      period: { label: "últimos 7 días", start: "2026-10-01", end: "2026-10-07" },
      operations: 42,
      sales: "$ 1.240.000",
      salesCents: 124_000_000,
      grossMargin: "$ 380.000",
      grossMarginCents: 38_000_000,
      expenses: "$ 290.000",
      expensesCents: 29_000_000,
      estimatedResult: "$ 90.000",
      estimatedResultCents: 9_000_000,
      comparisonsPercent: { sales: 43.3, grossMargin: 8.2, expenses: 72.2, estimatedResult: -18.3 },
    },
  }];

  it.each([
    "Analizá mi negocio.",
    "Haceme un análisis completo de mi negocio.",
    "¿Cómo viene mi negocio este mes?",
    "¿Qué debería mejorar?",
    "¿Qué pasó con mi negocio esta semana?",
  ])("crea un resumen ejecutivo estructurado para %s", (question) => {
    const presentation = buildAiPresentation(businessEvidence, question);
    expect(presentation).toMatchObject({
      type: "business-overview",
      summary: expect.not.stringContaining("**"),
      metrics: [
        { type: "sales", value: "$ 1.240.000", tone: "positive" },
        { type: "gross-margin", value: "$ 380.000" },
        { type: "expenses", value: "$ 290.000", tone: "attention" },
        { type: "estimated-result", value: "$ 90.000", tone: "attention" },
      ],
      recommendations: expect.arrayContaining(["Revisar qué gastos aumentaron más que las ventas."]),
      periodLabel: "1–7 oct 2026",
    });
    expect(presentation?.type === "business-overview" ? presentation.recommendations.length : 0).toBeLessThanOrEqual(3);
  });

  it("incorpora inventario y producto destacado solo cuando ya están en la evidencia", () => {
    const presentation = buildAiPresentation([
      ...businessEvidence,
      { tool: "get_inventory_analysis", data: { focus: "REORDER", products: [{ name: "Producto A" }, { name: "Producto B" }] } },
      { tool: "getProductProfitability", data: { mostProfitable: [{ name: "Algodón", grossMargin: "$ 34.650", units: 15 }] } },
    ], "Analizá mi negocio.");
    expect(presentation).toMatchObject({
      type: "business-overview",
      metrics: expect.arrayContaining([expect.objectContaining({ type: "inventory", value: "2 productos", tone: "attention" })]),
      highlightedProduct: { title: "Producto con mayor margen", productName: "Algodón", value: "$ 34.650" },
      recommendations: expect.arrayContaining(["Reponer primero los productos que necesitan atención de stock."]),
    });
  });

  it("mantiene como texto una explicación específica aunque use el resumen financiero", () => {
    expect(buildAiPresentation(businessEvidence, "¿Por qué vendí más pero gané menos?")).toBeUndefined();
  });

  it.each([
    ["LOW_STOCK", "stock", "Productos con stock bajo", "out_of_stock"],
    ["REORDER", "reorder", "Productos para reponer", "urgent_restock"],
    ["SLOW", "slow-moving", "Productos con baja rotación", "slow_moving"],
    ["EXCESS", "excess-stock", "Productos con mucho stock", "excess_stock"],
  ])("crea cards determinísticas para inventario %s", (focus, variant, title, status) => {
    const presentation = buildAiPresentation([{
      tool: "get_inventory_analysis",
      data: {
        focus,
        days: 30,
        products: [{ name: "Producto de prueba", currentStock: focus === "LOW_STOCK" ? 0 : 3, minimumStock: 2, unitsSold: 12, estimatedDaysRemaining: 4, priority: "URGENT" }],
      },
    }], "consulta");

    expect(presentation).toMatchObject({
      type: "product-list",
      variant,
      title,
      summary: expect.any(String),
      items: [{ productName: "Producto de prueba", currentStock: expect.any(Number), unitsSold: 12, status }],
    });
  });

  it("destaca el producto más vendido sin agregar productos ajenos", () => {
    const presentation = buildAiPresentation([{
      tool: "get_top_product_analysis",
      data: { period: { label: "este mes" }, product: "Café instantáneo", current: { units: 82, sales: "$ 336.200", grossMargin: "$ 52.400" } },
    }], "¿Qué producto vendo más?");

    expect(presentation).toEqual({
      type: "product-highlight",
      variant: "top-selling",
      title: "Producto más vendido",
      summary: "Este es el producto más vendido este mes.",
      periodLabel: "este mes",
      note: undefined,
      items: [{ productName: "Café instantáneo", unitsSold: 82, sales: "$ 336.200" }],
    });
  });

  it("presenta el producto menos vendido con unidades, ventas, stock y período", () => {
    const presentation = buildAiPresentation([{
      tool: "get_product_sales_ranking",
      data: {
        ranking: "LEAST_UNITS",
        period: { label: "este mes", start: "2026-10-01", end: "2026-10-09" },
        hasProducts: true,
        hasSales: true,
        products: [{ productName: "Harina integral", unitsSold: 1, revenue: "$ 2.500", cogs: "$ 1.600", grossMargin: "$ 900", marginPercent: 36, currentStock: 32, lastSaleDate: "2026-10-03", daysWithoutSales: 6 }],
      },
    }], "¿Qué producto vendí menos?");

    expect(presentation).toMatchObject({
      type: "product-highlight",
      variant: "least-selling",
      title: "Producto menos vendido",
      periodLabel: "este mes",
      items: [{ productName: "Harina integral", unitsSold: 1, sales: "$ 2.500", currentStock: 32, daysWithoutSales: 6 }],
    });
  });

  it("destaca solamente el producto con mayor margen", () => {
    const presentation = buildAiPresentation([{
      tool: "getProductProfitability",
      data: { period: { label: "este mes" }, mostProfitable: [{ name: "Energizante", units: 24, grossMargin: "$ 52.400" }, { name: "Otro", units: 10, grossMargin: "$ 10.000" }] },
    }], "¿Qué producto me deja más margen?");

    expect(presentation).toMatchObject({
      type: "product-highlight",
      variant: "top-margin",
      title: "Producto con mayor margen",
      summary: "Este es el producto que generó más margen este mes.",
      items: [{ productName: "Energizante", grossMargin: "$ 52.400", unitsSold: 24 }],
    });
  });

  it("no crea una presentación si la tool no devuelve productos", () => {
    expect(buildAiPresentation([{ tool: "get_inventory_analysis", data: { focus: "LOW_STOCK", products: [] } }], "consulta")).toBeUndefined();
  });

  it("presenta una métrica simple con valor, comparación y período", () => {
    const presentation = buildAiPresentation(businessEvidence, "¿Cuánto vendí en los últimos 7 días?");
    expect(presentation).toMatchObject({
      type: "metric",
      title: "Ventas",
      value: "$ 1.240.000",
      comparison: "43,3% más que el período anterior",
      periodLabel: "1–7 oct 2026",
    });
  });

  it("presenta gastos actuales y anteriores por categoría", () => {
    const presentation = buildAiPresentation([{
      tool: "get_expense_breakdown",
      data: {
        period: { label: "este mes", start: "2026-10-01", end: "2026-10-09" },
        total: "$ 290.000",
        previousTotal: "$ 258.000",
        difference: "$ 32.000",
        comparisonPercent: 12.4,
        categories: [{ name: "Servicios", amount: "$ 90.000", previousAmount: "$ 70.000", difference: "$ 20.000", percentageDifference: 28.6 }],
      },
    }], "¿En qué gasté más?");
    expect(presentation).toMatchObject({
      type: "expense-breakdown",
      total: "$ 290.000",
      categories: [{ name: "Servicios", amount: "$ 90.000", previousAmount: "$ 70.000", difference: "$ 20.000" }],
    });
  });
});
