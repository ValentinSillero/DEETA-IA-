import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  detectProductImportMapping,
  parseProductImportFile,
  productImportSummary,
  validateProductImportMapping,
  validateProductImportRows,
  type ProductImportMapping,
} from "@/lib/product-imports";

const mapping: ProductImportMapping = {
  "0": "NAME",
  "1": "BARCODE",
  "2": "COST_PRICE",
  "3": "SALE_PRICE",
  "4": "INITIAL_STOCK",
  "5": "MINIMUM_STOCK",
};

describe("archivos de importación de productos", () => {
  it("lee CSV con punto y coma y conserva códigos con cero inicial", async () => {
    const parsed = await parseProductImportFile(
      Buffer.from("Producto;Código de barras;Costo;Precio de venta;Stock;Stock mínimo\nYerba;001234567890;1.500,50;2100;8;2"),
      "CSV",
    );

    expect(parsed.headers).toHaveLength(6);
    expect(parsed.rows[0][1]).toBe("001234567890");
    expect(parsed.suggestedMapping).toEqual(mapping);
  });

  it("lee XLSX y no ejecuta fórmulas", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Productos");
    sheet.addRow(["Nombre", "Código", "Precio compra", "Precio venta", "Stock", "Mínimo"]);
    sheet.addRow(["Galletas", "000123", 100, 180, 4, 1]);
    sheet.addRow([{ formula: "1+1", result: "No usar" }, "000124", 100, 180, 4, 1]);
    const bytes = await workbook.xlsx.writeBuffer();

    const parsed = await parseProductImportFile(Buffer.from(bytes), "XLSX");
    const validated = validateProductImportRows(
      parsed.rows.map((rawValues, index) => ({ id: String(index), rowNumber: index + 2, rawValues })),
      mapping,
      new Map(),
      "SKIP",
    );

    expect(parsed.rows[0][1]).toBe("000123");
    expect(validated[0]).toMatchObject({ status: "READY", barcode: "000123", costPriceCents: 10_000 });
    expect(validated[1].status).toBe("ERROR");
    expect(validated[1].issues.join(" ")).toContain("fórmula");
  });

  it("permite correspondencia manual y exige una única columna de nombre", () => {
    const headers = ["Artículo interno", "Valor", "PVP"];
    expect(detectProductImportMapping(headers)).toEqual({ "0": "IGNORE", "1": "IGNORE", "2": "SALE_PRICE" });
    expect(validateProductImportMapping(headers, { "0": "NAME", "1": "COST_PRICE", "2": "SALE_PRICE" })).toEqual([]);
    expect(validateProductImportMapping(headers, { "0": "NAME", "1": "NAME", "2": "SALE_PRICE" })).toEqual([
      "Asignaste “Nombre” más de una vez.",
    ]);
  });

  it("marca errores, advertencias y códigos duplicados antes de confirmar", () => {
    const rows = validateProductImportRows([
      { id: "1", rowNumber: 2, rawValues: ["Yerba", "001", "100", "150", "2", "1"] },
      { id: "2", rowNumber: 3, rawValues: ["Azúcar", "001", "80", "120", "3", "1"] },
      { id: "3", rowNumber: 4, rawValues: ["Café", "", "200", "350", "", ""] },
      { id: "4", rowNumber: 5, rawValues: ["", "004", "-1", "100", "-2", "0"] },
    ], mapping, new Map(), "SKIP");

    expect(rows.slice(0, 2).every((row) => row.status === "ERROR")).toBe(true);
    expect(rows[2]).toMatchObject({ status: "WARNING", initialStock: 0, minimumStock: 0 });
    expect(rows[3].status).toBe("ERROR");
    expect(productImportSummary(rows)).toEqual({ total: 4, ready: 0, warning: 1, error: 3, skipped: 0 });
  });

  it("distingue productos existentes según la estrategia elegida", () => {
    const source = [{ id: "1", rowNumber: 2, rawValues: ["Yerba", "001", "100", "150", "2", "1"] }];
    const existing = new Map([["001", "existing-product"]]);
    expect(validateProductImportRows(source, mapping, existing, "SKIP")[0]).toMatchObject({
      status: "WARNING",
      existingProductId: "existing-product",
    });
    expect(validateProductImportRows(source, mapping, existing, "UPDATE_PRICES")[0]).toMatchObject({
      status: "READY",
      existingProductId: "existing-product",
    });
  });

  it.each([500, 2_000, 10_000])("procesa %i filas en un tiempo razonable", (rowCount) => {
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      id: String(index),
      rowNumber: index + 2,
      rawValues: [`Producto ${index}`, String(100_000 + index), "100", "150", "1", "0"],
    }));
    const startedAt = performance.now();
    const result = validateProductImportRows(rows, mapping, new Map(), "SKIP");
    expect(result).toHaveLength(rowCount);
    expect(result.every((row) => row.status === "READY")).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  });
});
