import { describe, expect, it } from "vitest";

import { buildDeterministicInsights } from "@/lib/ai/insights";

describe("insights determinísticos", () => {
  it("redacta solamente señales respaldadas por métricas", () => {
    expect(buildDeterministicInsights({ lowStockCount: 4, salesComparisonPercent: 15, expensesComparisonPercent: null })).toEqual([
      "Hay 4 productos con poco stock.",
      "Hoy vendiste 15% más que ayer.",
    ]);
  });
});
