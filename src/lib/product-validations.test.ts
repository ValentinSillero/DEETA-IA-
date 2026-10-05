import { describe, expect, it } from "vitest";

import { parseMoneyToCents, productCreateSchema } from "@/lib/product-validations";

describe("precios de productos", () => {
  it("convierte importes argentinos a centavos sin coma flotante", () => {
    expect(parseMoneyToCents("15.500")).toBe(1_550_000);
    expect(parseMoneyToCents("1.500,50")).toBe(150_050);
    expect(parseMoneyToCents("1500.25")).toBe(150_025);
  });

  it("rechaza precios negativos y stock inicial negativo", () => {
    const result = productCreateSchema.safeParse({
      name: "Producto",
      description: "",
      costPriceCents: "-1",
      salePriceCents: "10",
      initialStock: "-2",
      minimumStock: "0",
      barcode: "",
    });
    expect(result.success).toBe(false);
  });
});
