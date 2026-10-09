import { describe, expect, it } from "vitest";

import { evidenceAnswersPlan, fallbackPlanForEvidence, isAiToolResultAnswerable } from "@/lib/ai/answerability";

const period = { label: "este mes", start: "2026-10-01", end: "2026-10-09" };

describe("answerability de DEETA AI", () => {
  it("rechaza un resumen de rotación que no responde cuál fue el producto menos vendido", () => {
    const messages = [{ role: "USER" as const, content: "¿Qué producto vendí menos?" }];
    const evidence = [{ tool: "getAutomaticInsights", data: { slowMovingCount: 1, immobilizedValue: "$ 115.200" } }];
    expect(fallbackPlanForEvidence(messages, evidence)).toEqual({
      name: "get_product_sales_ranking",
      arguments: { kind: "CURRENT_MONTH", month: null, ranking: "LEAST_UNITS", limit: 1 },
    });
  });

  it("acepta el ranking solo cuando incluye producto, unidades, ventas, stock y período", () => {
    const complete = {
      ranking: "LEAST_UNITS", period, hasProducts: true, hasSales: true,
      products: [{ productName: "Harina", unitsSold: 1, revenueCents: 250_00, revenue: "$ 250", currentStock: 32 }],
    };
    expect(isAiToolResultAnswerable("get_product_sales_ranking", complete)).toBe(true);
    expect(isAiToolResultAnswerable("get_product_sales_ranking", { ...complete, products: [{ unitsSold: 1 }] })).toBe(false);
    expect(evidenceAnswersPlan(
      { name: "get_product_sales_ranking", arguments: {} },
      [{ tool: "get_product_sales_ranking", data: complete }],
    )).toBe(true);
  });

  it("considera contestable un resultado vacío explícito", () => {
    expect(isAiToolResultAnswerable("get_product_sales_ranking", {
      ranking: "NO_SALES", period, hasProducts: true, products: [],
    })).toBe(true);
  });
});
