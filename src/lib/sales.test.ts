import { describe, expect, it } from "vitest";

import {
  cashDifference,
  expectedCashAfterSale,
  stockAfterCancellation,
  stockAfterSale,
  saleRequestRows,
} from "@/lib/sales";
import { resourceBelongsToBusiness } from "@/lib/inventory";

describe("venta y stock", () => {
  it("descuenta 2 unidades de un stock de 10", () => {
    expect(stockAfterSale(10, 2)).toBe(8);
  });

  it("rechaza la venta completa si el stock es insuficiente", () => {
    expect(() => stockAfterSale(1, 2)).toThrow("INSUFFICIENT_STOCK");
  });

  it("devuelve el stock al cancelar", () => {
    expect(stockAfterCancellation(8, 2)).toBe(10);
  });

  it("prepara claves SQL completas para guardar venta, items y movimientos", () => {
    const [row] = saleRequestRows([{ productId: "product-a", quantity: 2 }]);
    expect(row).toMatchObject({ product_id: "product-a", quantity: 2 });
    expect(row.item_id).toBeTruthy();
    expect(row.movement_id).toBeTruthy();
  });
});

describe("caja", () => {
  it("suma solamente ventas en efectivo a la caja esperada", () => {
    expect(expectedCashAfterSale(2_000_000, 500_000, "CASH")).toBe(2_500_000);
    expect(expectedCashAfterSale(2_000_000, 500_000, "TRANSFER")).toBe(2_000_000);
    expect(expectedCashAfterSale(2_000_000, 500_000, "CARD")).toBe(2_000_000);
  });

  it("calcula cierre correcto sin diferencia", () => {
    expect(cashDifference(2_500_000, 2_500_000)).toBe(0);
  });

  it("conserva una diferencia negativa real", () => {
    expect(cashDifference(2_500_000, 2_350_000)).toBe(-150_000);
  });
});

describe("aislamiento multiempresa de ventas y caja", () => {
  it("rechaza recursos de otro negocio", () => {
    expect(resourceBelongsToBusiness("business-a", "business-b")).toBe(false);
  });

  it("admite recursos del negocio autenticado", () => {
    expect(resourceBelongsToBusiness("business-a", "business-a")).toBe(true);
  });
});
