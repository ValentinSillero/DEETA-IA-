import { describe, expect, it } from "vitest";

import { calculateFinancialResult, percentageChange } from "@/lib/finance";

describe("rentabilidad", () => {
  it("calcula margen y resultado estimado en centavos", () => {
    expect(calculateFinancialResult({ salesCents: 10_000, cogsCents: 6_000, expensesCents: 1_500, operations: 1 }))
      .toMatchObject({ grossMarginCents: 4_000, estimatedResultCents: 2_500, grossMarginPercent: 40 });
  });

  it("calcula variaciones y evita dividir por cero", () => {
    expect(percentageChange(100_000, 80_000)).toBe(25);
    expect(percentageChange(0, 0)).toBe(0);
    expect(percentageChange(100, 0)).toBeNull();
  });
});
