import { describe, expect, it } from "vitest";

import { catalogRelevance, parseCatalogCsv, parseExclusions, parseRelevanceRules } from "@/db/catalog-seed";
import { catalogAddSchema, catalogCategoryPriority, catalogProductName, catalogSearchTerms } from "@/lib/catalog";

describe("lectura del CSV del catálogo", () => {
  const header = "barcode,name,size,category,brand,kiosk,needs_review,source";

  it("normaliza filas válidas", () => {
    const { rows, skipped } = parseCatalogCsv(`${header}\n7790001000012, Alfajor  triple ,60 g,Alfajores,Marca,1,0,off\n7790001000029,Yerba,,Yerba,,0,1,off`);
    expect(skipped).toEqual([]);
    expect(rows[0]).toEqual({ barcode: "7790001000012", name: "Alfajor triple", size: "60 g", category: "Alfajores", brand: "Marca", isKiosk: true, needsReview: false, source: "off" });
    expect(rows[1]).toMatchObject({ size: null, brand: null, isKiosk: false, needsReview: true });
  });

  it("descarta códigos inválidos, filas sin nombre y códigos repetidos", () => {
    const { rows, skipped } = parseCatalogCsv(`${header}\nabc,Producto,,Cat,,0,0,off\n7790001000012,Uno,,Cat,,0,0,off\n7790001000012,Repetido,,Cat,,0,0,off\n7790001000029,,,Cat,,0,0,off`);
    expect(rows.map((row) => row.name)).toEqual(["Uno"]);
    expect(skipped.map((skip) => skip.reason)).toEqual(["Código de barras inválido", "Código repetido en el archivo", "Falta el nombre"]);
  });
});

describe("reglas del catálogo", () => {
  it("arma el nombre con el tamaño sin repetirlo", () => {
    expect(catalogProductName("Coca-Cola", "2,25 L")).toBe("Coca-Cola 2,25 L");
    expect(catalogProductName("Coca-Cola 2,25 L", "2,25 l")).toBe("Coca-Cola 2,25 L");
    expect(catalogProductName("Yerba", null)).toBe("Yerba");
  });

  it("escapa comodines en la búsqueda", () => {
    expect(catalogSearchTerms("  Coca  100%_x ")).toEqual(["coca", "100\\%\\_x"]);
  });

  it("muestra primero bebidas, alfajores, golosinas y snacks en un kiosco", () => {
    const kiosk = catalogCategoryPriority("KIOSK");
    expect(kiosk.slice(0, 2)).toEqual(["Bebidas", "Alfajores"]);
    expect(kiosk.indexOf("Snacks")).toBeLessThan(kiosk.indexOf("Galletitas"));
    // Almacén empieza por lo básico; "Almacén varios" queda al final.
    expect(catalogCategoryPriority("GROCERY")[0]).toBe("Bebidas");
    expect(catalogCategoryPriority("GROCERY")).not.toContain("Almacén varios");
  });

  it("calcula la relevancia desde las reglas de marca, sin nombres hardcodeados", () => {
    const rules = parseRelevanceRules("tipo,valor,puntos\nmarca,coca-cola,80\nmarca,jorgito,70\n");
    const base = { size: "2 L", category: "Bebidas", isKiosk: true, needsReview: false, source: "off" };
    expect(catalogRelevance({ ...base, barcode: "1", name: "Coca Cola Original", brand: "Coca-Cola" }, rules)).toBe(95);
    expect(catalogRelevance({ ...base, barcode: "2", name: "Alfajor Jorgito", brand: "Jorgito" , source: "distribuidora+off" }, rules)).toBe(100);
    expect(catalogRelevance({ ...base, barcode: "3", name: "3 vegetales codito", brand: "Desconocida", size: null, needsReview: true }, rules)).toBe(0);
  });

  it("lee las exclusiones con su motivo", () => {
    expect(parseExclusions("barcode,reason\n7796285281397,Medicamento\nabc,Mal\n")).toEqual([{ barcode: "7796285281397", reason: "Medicamento" }]);
  });

  it("valida el lote: precio de venta obligatorio, el resto opcional", () => {
    const ok = catalogAddSchema.safeParse([{ barcode: "7790001000012", salePriceCents: "1.500,50", costPriceCents: "", initialStock: "", minimumStock: "3" }]);
    expect(ok.success && ok.data[0]).toEqual({ barcode: "7790001000012", salePriceCents: 150050, costPriceCents: 0, initialStock: 0, minimumStock: 3 });
    const bad = catalogAddSchema.safeParse([{ barcode: "7790001000012", salePriceCents: "", costPriceCents: "-1", initialStock: "1.5", minimumStock: "" }]);
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((issue) => issue.path.at(-1))).toEqual(["salePriceCents", "costPriceCents", "initialStock"]);
    expect(catalogAddSchema.safeParse([]).success).toBe(false);
  });
});
