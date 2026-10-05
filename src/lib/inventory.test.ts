import { describe, expect, it } from "vitest";

import {
  calculateStockMovement,
  resourceBelongsToBusiness,
  stockStatus,
} from "@/lib/inventory";

describe("movimientos de stock", () => {
  it("registra stock inicial 10 e ingreso 5 con resultado 15", () => {
    expect(calculateStockMovement(10, "IN", 5)).toEqual({
      previousStock: 10,
      resultingStock: 15,
      quantity: 5,
    });
  });

  it("quita 3 unidades de un stock de 15", () => {
    expect(calculateStockMovement(15, "OUT", 3)).toEqual({
      previousStock: 15,
      resultingStock: 12,
      quantity: -3,
    });
  });

  it("rechaza una salida que dejaría stock negativo", () => {
    expect(() => calculateStockMovement(2, "OUT", 3)).toThrow("NEGATIVE_STOCK");
  });

  it("ajusta el stock contado y registra la diferencia", () => {
    expect(calculateStockMovement(10, "ADJUSTMENT", 8)).toEqual({
      previousStock: 10,
      resultingStock: 8,
      quantity: -2,
    });
  });
});

describe("avisos de stock", () => {
  it("considera poco stock cuando quedan 3 y el mínimo es 5", () => {
    expect(stockStatus(3, 5)).toBe("LOW_STOCK");
  });

  it("diferencia sin stock de poco stock", () => {
    expect(stockStatus(0, 5)).toBe("OUT_OF_STOCK");
  });

  it("no marca poco stock cuando el mínimo es cero", () => {
    expect(stockStatus(3, 0)).toBe("AVAILABLE");
  });
});

describe("aislamiento de productos", () => {
  it("un negocio no puede acceder al producto de otro", () => {
    expect(resourceBelongsToBusiness("business-a", "business-b")).toBe(false);
  });

  it("permite el producto del mismo negocio", () => {
    expect(resourceBelongsToBusiness("business-a", "business-a")).toBe(true);
  });
});
