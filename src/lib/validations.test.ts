import { describe, expect, it } from "vitest";

import { businessSchema } from "@/lib/validations";

const validBusiness = {
  name: "Almacén del barrio",
  category: "GROCERY",
  city: "Montevideo",
  province: "Montevideo",
  phone: "099 123 456",
};

describe("validación del negocio", () => {
  it("acepta datos válidos", () => {
    expect(businessSchema.safeParse(validBusiness).success).toBe(true);
  });

  it("rechaza rubros inventados y campos obligatorios vacíos", () => {
    const result = businessSchema.safeParse({
      ...validBusiness,
      name: "",
      category: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("convierte el teléfono vacío en null", () => {
    const result = businessSchema.parse({ ...validBusiness, phone: "" });
    expect(result.phone).toBeNull();
  });
});
