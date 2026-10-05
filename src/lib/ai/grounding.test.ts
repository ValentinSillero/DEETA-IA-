import { describe, expect, it } from "vitest";

import { unsupportedNumericClaims } from "@/lib/ai/grounding";

describe("control de cifras de DEETA AI", () => {
  it("acepta formatos equivalentes y rechaza números sin respaldo", () => {
    const evidence = [{ salesCents: 185000000, sales: "$ 1.850.000", comparison: 12.5 }];
    expect(unsupportedNumericClaims("Vendiste $1.850.000, un 12,5% más.", evidence)).toEqual([]);
    expect(unsupportedNumericClaims("Vendiste $1.900.000.", evidence)).toEqual(["1900000"]);
  });
});
