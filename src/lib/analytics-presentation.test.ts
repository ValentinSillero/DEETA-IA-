import { describe, expect, it } from "vitest";

import { buildAnalysisSummary, comparisonChangeText, comparisonLabel, comparisonReference, formatAnalysisMoney, metricExplanation } from "@/lib/analytics-presentation";

describe("explicaciones cotidianas de análisis", () => {
  it("explica cuando las ventas suben pero el resultado baja", () => {
    expect(buildAnalysisSummary({
      operations: 25,
      grossMarginCents: 100_000,
      expensesCents: 130_000,
      estimatedResultCents: -30_000,
      comparisons: { sales: 12, expenses: 38, estimatedResult: -17.7 },
    })).toEqual([
      "Vendiste más que el período anterior, pero tus gastos crecieron mucho más.",
      "Por eso tu resultado estimado fue menor que el período anterior.",
    ]);
  });

  it("no inventa comparaciones cuando faltan datos anteriores", () => {
    expect(buildAnalysisSummary({
      operations: 3,
      grossMarginCents: 50_000,
      expensesCents: 10_000,
      estimatedResultCents: 40_000,
      comparisons: { sales: null, expenses: null, estimatedResult: null },
    })[0]).toContain("todavía no hay datos anteriores suficientes");
  });

  it("convierte porcentajes en comparaciones compactas", () => {
    expect(comparisonChangeText(-17.7, "el mes pasado")).toBe("17,7% vs. mes pasado");
    expect(comparisonChangeText(12, "ayer")).toBe("12% vs. ayer");
    expect(comparisonChangeText(0.2, "el mes pasado")).toBe("Sin cambios relevantes");
    expect(comparisonChangeText(null, "el mes pasado")).toBe("Sin período anterior");
  });

  it("nombra con claridad el período de comparación", () => {
    expect(comparisonLabel("TODAY")).toBe("Comparando con ayer");
    expect(comparisonLabel("LAST_7_DAYS")).toBe("Comparando con los 7 días anteriores");
    expect(comparisonLabel("LAST_30_DAYS")).toBe("Comparando con los 30 días anteriores");
    expect(comparisonLabel("CURRENT_MONTH")).toBe("Comparando con el mes pasado");
  });

  it("mantiene términos profesionales con interpretaciones de una sola oración", () => {
    const reference = comparisonReference("CURRENT_MONTH");

    expect(metricExplanation({ key: "sales", currentCents: 1_240_000_00, change: 8.4, reference })).toBe("Vendiste más que el mes pasado.");
    expect(metricExplanation({ key: "sales", currentCents: 1_000, change: -8, reference })).toBe("Vendiste menos que el mes pasado.");
    expect(metricExplanation({ key: "expenses", currentCents: 290_000_00, change: 458.7, reference })).toBe("Subieron mucho respecto del mes pasado.");
    expect(metricExplanation({ key: "expenses", currentCents: 200_000, change: -12, reference })).toBe("Bajaron respecto del mes pasado.");
    expect(metricExplanation({ key: "grossMargin", currentCents: 380_000_00, change: 8.4, reference })).toBe("Mejoró levemente.");
    expect(metricExplanation({ key: "grossMargin", currentCents: 300_000, change: -15, reference })).toBe("Empeoró.");
    expect(metricExplanation({ key: "estimatedResult", currentCents: 90_000_00, change: -84.7, reference })).toBe("Te quedó bastante menos que el mes pasado.");
    expect(metricExplanation({ key: "estimatedResult", currentCents: 120_000, change: 30, reference })).toBe("Te quedó bastante más que el mes pasado.");
    expect(metricExplanation({ key: "estimatedResult", currentCents: -50_000, change: null, reference })).toBe("El resultado del período fue negativo.");
    expect(metricExplanation({ key: "estimatedResult", currentCents: 50_000, change: null, reference })).toBe("El resultado del período fue positivo.");
    expect(metricExplanation({ key: "averageTicket", currentCents: 643_000, change: 3.1, reference })).toBe("Cada venta fue mayor que el mes pasado.");
    expect(metricExplanation({ key: "averageTicket", currentCents: 643_000, change: null, reference })).toBe("Todavía no hay datos para comparar.");
  });

  it("redondea los importes principales para facilitar una lectura rápida", () => {
    expect(formatAnalysisMoney(1_962_374)).toBe("$ 19.624");
  });
});
