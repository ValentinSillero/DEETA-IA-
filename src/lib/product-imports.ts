import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";

import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import { parseMoneyToCents } from "@/lib/product-validations";

export const PRODUCT_IMPORT_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxRows: 10_000,
  maxColumns: 50,
  maxCellCharacters: 2_000,
  insertChunkSize: 500,
  previewRows: 80,
} as const;

export const PRODUCT_IMPORT_FIELDS = [
  "NAME",
  "BARCODE",
  "COST_PRICE",
  "SALE_PRICE",
  "INITIAL_STOCK",
  "MINIMUM_STOCK",
  "DESCRIPTION",
  "IGNORE",
] as const;

export type ProductImportField = (typeof PRODUCT_IMPORT_FIELDS)[number];
export type ProductImportMapping = Record<string, ProductImportField>;
export type ExistingProductStrategy = "SKIP" | "UPDATE_PRICES" | "UPDATE_PRICES_STOCK";

export const PRODUCT_IMPORT_FIELD_LABELS: Record<ProductImportField, string> = {
  NAME: "Nombre",
  BARCODE: "Código de barras",
  COST_PRICE: "Precio de compra",
  SALE_PRICE: "Precio de venta",
  INITIAL_STOCK: "Stock inicial",
  MINIMUM_STOCK: "Stock mínimo",
  DESCRIPTION: "Descripción",
  IGNORE: "Ignorar esta columna",
};

export type ParsedProductFile = {
  headers: string[];
  rows: string[][];
  suggestedMapping: ProductImportMapping;
};

export type ImportSourceRow = {
  id: string;
  rowNumber: number;
  rawValues: string[];
  overrides?: Record<string, string> | null;
  included?: boolean;
};

export type ValidatedImportRow = {
  id: string;
  rowNumber: number;
  included: boolean;
  status: "READY" | "WARNING" | "ERROR" | "SKIPPED";
  issues: string[];
  name: string | null;
  description: string | null;
  barcode: string | null;
  costPriceCents: number | null;
  salePriceCents: number | null;
  initialStock: number | null;
  minimumStock: number | null;
  existingProductId: string | null;
};

const FORMULA_CELL = "__DEETA_FORMULA_CELL__";

function normalizedHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function headerCandidates(header: string): ProductImportField[] {
  const value = normalizedHeader(header);
  if (!value) return [];
  if (/^(codigo|codigo de barras|codigo barra|ean|barcode|sku)$/.test(value)) return ["BARCODE"];
  if (/^(precio de compra|precio compra|costo|coste|compra)$/.test(value)) return ["COST_PRICE"];
  if (/^(precio de venta|precio venta|venta|pvp)$/.test(value)) return ["SALE_PRICE"];
  if (/^(stock minimo|minimo|stock de seguridad)$/.test(value)) return ["MINIMUM_STOCK"];
  if (/^(stock|cantidad|existencia|existencias|unidades)$/.test(value)) return ["INITIAL_STOCK"];
  if (/^(producto|nombre|articulo|item)$/.test(value)) return ["NAME"];
  if (/^(descripcion|detalle|observacion|observaciones|notas?)$/.test(value)) return ["NAME", "DESCRIPTION"];
  if (value.includes("barra") || value.includes("ean")) return ["BARCODE"];
  if (value.includes("minim")) return ["MINIMUM_STOCK"];
  if (value.includes("costo") || value.includes("compra")) return ["COST_PRICE"];
  if (value.includes("venta") || value === "precio") return ["SALE_PRICE"];
  if (value.includes("stock") || value.includes("cantidad")) return ["INITIAL_STOCK"];
  return [];
}

export function detectProductImportMapping(headers: string[]) {
  const mapping: ProductImportMapping = {};
  const used = new Set<ProductImportField>();
  headers.forEach((header, index) => {
    const candidate = headerCandidates(header).find((field) => !used.has(field));
    mapping[String(index)] = candidate ?? "IGNORE";
    if (candidate) used.add(candidate);
  });
  return mapping;
}

export function validateProductImportMapping(headers: string[], mapping: ProductImportMapping) {
  const issues: string[] = [];
  const assigned = new Map<ProductImportField, number>();
  headers.forEach((_, index) => {
    const field = mapping[String(index)] ?? "IGNORE";
    if (field === "IGNORE") return;
    if (!PRODUCT_IMPORT_FIELDS.includes(field)) {
      issues.push("Hay una correspondencia de columna que no reconocemos.");
      return;
    }
    if (assigned.has(field)) issues.push(`Asignaste “${PRODUCT_IMPORT_FIELD_LABELS[field]}” más de una vez.`);
    assigned.set(field, index);
  });
  if (!assigned.has("NAME")) issues.push("Indicá qué columna contiene el nombre del producto.");
  return issues;
}

function decodeCsv(buffer: Buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
}

function detectCsvDelimiter(content: string) {
  const header = content.split(/\r?\n/, 1)[0] ?? "";
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let index = 0; index < header.length; index += 1) {
    const character = header[index];
    if (character === '"') {
      if (quoted && header[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ",";
}

function cleanParsedRows(input: unknown[][]): { headers: string[]; rows: string[][] } {
  const converted = input.map((row) => row.map((cell) => String(cell ?? "")));
  const nonempty = converted.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (nonempty.length < 2) throw new Error("EMPTY_FILE");
  const width = Math.max(...nonempty.map((row) => row.length));
  if (width > PRODUCT_IMPORT_LIMITS.maxColumns) throw new Error("TOO_MANY_COLUMNS");
  const [headerRow, ...dataRows] = nonempty;
  if (dataRows.length > PRODUCT_IMPORT_LIMITS.maxRows) throw new Error("TOO_MANY_ROWS");
  const headers = Array.from({ length: width }, (_, index) => headerRow[index]?.trim() || `Columna ${index + 1}`);
  const rows = dataRows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
  for (const row of [headers, ...rows]) {
    if (row.some((cell) => cell.length > PRODUCT_IMPORT_LIMITS.maxCellCharacters)) throw new Error("CELL_TOO_LONG");
  }
  return { headers, rows };
}

function excelCellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) return FORMULA_CELL;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  if (value && typeof value === "object" && "text" in value) return String(value.text ?? "");
  return cell.text || String(value ?? "");
}

export async function parseProductImportFile(buffer: Buffer, type: "CSV" | "XLSX"): Promise<ParsedProductFile> {
  let values: unknown[][];
  if (type === "CSV") {
    const content = decodeCsv(buffer);
    values = parseCsv(content, {
      bom: true,
      delimiter: detectCsvDelimiter(content),
      relax_column_count: true,
      skip_empty_lines: true,
      max_record_size: PRODUCT_IMPORT_LIMITS.maxCellCharacters * PRODUCT_IMPORT_LIMITS.maxColumns,
    }) as unknown[][];
  } else {
    const workbook = new ExcelJS.Workbook();
    // ExcelJS still declares the pre-generic Node Buffer shape. The runtime value is
    // the same Buffer received from the route, so only bridge the declaration gap.
    const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(excelBuffer, { ignoreNodes: ["dataValidations", "drawing", "hyperlinks"] });
    const worksheet = workbook.worksheets.find((sheet) => sheet.actualRowCount > 0);
    if (!worksheet) throw new Error("EMPTY_FILE");
    values = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = Array.from({ length: row.cellCount }, (_, index) => excelCellText(row.getCell(index + 1)));
      values.push(cells);
    });
  }
  const parsed = cleanParsedRows(values);
  return { ...parsed, suggestedMapping: detectProductImportMapping(parsed.headers) };
}

function mappedValue(row: ImportSourceRow, mapping: ProductImportMapping, field: ProductImportField) {
  if (row.overrides && Object.prototype.hasOwnProperty.call(row.overrides, field)) return row.overrides[field] ?? "";
  const entry = Object.entries(mapping).find(([, mapped]) => mapped === field);
  return entry ? row.rawValues[Number(entry[0])] ?? "" : "";
}

export function productImportEditableValues(row: ImportSourceRow, mapping: ProductImportMapping) {
  return {
    NAME: mappedValue(row, mapping, "NAME"),
    BARCODE: mappedValue(row, mapping, "BARCODE"),
    COST_PRICE: mappedValue(row, mapping, "COST_PRICE"),
    SALE_PRICE: mappedValue(row, mapping, "SALE_PRICE"),
    INITIAL_STOCK: mappedValue(row, mapping, "INITIAL_STOCK"),
    MINIMUM_STOCK: mappedValue(row, mapping, "MINIMUM_STOCK"),
    DESCRIPTION: mappedValue(row, mapping, "DESCRIPTION"),
  };
}

function parseImportInteger(raw: string) {
  const compact = raw.trim().replace(/[\s.]/g, "");
  if (!compact) return null;
  if (!/^\d+$/.test(compact)) return Number.NaN;
  const value = Number(compact);
  return Number.isSafeInteger(value) && value <= 1_000_000_000 ? value : Number.NaN;
}

export function validateProductImportRows(
  rows: ImportSourceRow[],
  mapping: ProductImportMapping,
  existingProducts: Map<string, string>,
  strategy: ExistingProductStrategy,
) {
  const draft = rows.map((row) => {
    if (row.included === false) {
      return {
        id: row.id,
        rowNumber: row.rowNumber,
        included: false,
        status: "SKIPPED" as const,
        issues: ["Esta fila fue excluida."],
        name: null,
        description: null,
        barcode: null,
        costPriceCents: null,
        salePriceCents: null,
        initialStock: null,
        minimumStock: null,
        existingProductId: null,
      };
    }

    const issues: string[] = [];
    const errors: string[] = [];
    const rawName = mappedValue(row, mapping, "NAME").trim();
    const rawDescription = mappedValue(row, mapping, "DESCRIPTION").trim();
    const rawBarcode = mappedValue(row, mapping, "BARCODE");
    const rawCost = mappedValue(row, mapping, "COST_PRICE");
    const rawSale = mappedValue(row, mapping, "SALE_PRICE");
    const rawStock = mappedValue(row, mapping, "INITIAL_STOCK");
    const rawMinimum = mappedValue(row, mapping, "MINIMUM_STOCK");

    if (!rawName) errors.push("Falta el nombre del producto.");
    else if (rawName === FORMULA_CELL) errors.push("El nombre contiene una fórmula. Reemplazala por un valor.");
    else if (rawName.length < 2 || rawName.length > 160) errors.push("El nombre debe tener entre 2 y 160 caracteres.");

    const barcode = rawBarcode && rawBarcode !== FORMULA_CELL ? normalizeBarcode(rawBarcode) : null;
    if (rawBarcode === FORMULA_CELL) errors.push("El código contiene una fórmula. Reemplazala por texto.");
    else if (barcode && !isValidBarcode(barcode)) errors.push("El código de barras no es válido.");
    else if (!barcode) issues.push("Sin código de barras.");

    const costPriceCents = rawCost && rawCost !== FORMULA_CELL ? parseMoneyToCents(rawCost) : Number.NaN;
    const salePriceCents = rawSale && rawSale !== FORMULA_CELL ? parseMoneyToCents(rawSale) : Number.NaN;
    if (!Number.isFinite(costPriceCents)) errors.push("Indicá un precio de compra válido.");
    else if (costPriceCents < 0) errors.push("El precio de compra no puede ser negativo.");
    if (!Number.isFinite(salePriceCents)) errors.push("Indicá un precio de venta válido.");
    else if (salePriceCents < 0) errors.push("El precio de venta no puede ser negativo.");

    const parsedStock = parseImportInteger(rawStock);
    const parsedMinimum = parseImportInteger(rawMinimum);
    if (Number.isNaN(parsedStock)) errors.push("El stock inicial debe ser un número entero no negativo.");
    else if (parsedStock === null) issues.push("Sin stock inicial: se usará 0.");
    if (Number.isNaN(parsedMinimum)) errors.push("El stock mínimo debe ser un número entero no negativo.");

    const existingProductId = barcode ? existingProducts.get(barcode) ?? null : null;
    if (existingProductId && strategy === "SKIP") issues.push("Este producto ya existe y no se modificará.");

    return {
      id: row.id,
      rowNumber: row.rowNumber,
      included: true,
      status: errors.length > 0 ? "ERROR" as const : issues.length > 0 ? "WARNING" as const : "READY" as const,
      issues: [...errors, ...issues],
      name: rawName && rawName !== FORMULA_CELL ? rawName : null,
      description: rawDescription && rawDescription !== FORMULA_CELL ? rawDescription.slice(0, 1000) : null,
      barcode,
      costPriceCents: Number.isFinite(costPriceCents) ? costPriceCents : null,
      salePriceCents: Number.isFinite(salePriceCents) ? salePriceCents : null,
      initialStock: parsedStock ?? 0,
      minimumStock: parsedMinimum ?? 0,
      existingProductId,
    } satisfies ValidatedImportRow;
  });

  const barcodeRows = new Map<string, ValidatedImportRow[]>();
  for (const row of draft) {
    if (!row.included || !row.barcode) continue;
    const matches = barcodeRows.get(row.barcode) ?? [];
    matches.push(row);
    barcodeRows.set(row.barcode, matches);
  }
  for (const matches of barcodeRows.values()) {
    if (matches.length < 2) continue;
    for (const row of matches) {
      row.status = "ERROR";
      row.issues = ["Este código aparece más de una vez en el archivo.", ...row.issues];
    }
  }
  return draft;
}

export function productImportSummary(rows: ValidatedImportRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.status === "READY") summary.ready += 1;
      else if (row.status === "WARNING") summary.warning += 1;
      else if (row.status === "ERROR") summary.error += 1;
      else summary.skipped += 1;
      return summary;
    },
    { total: rows.length, ready: 0, warning: 0, error: 0, skipped: 0 },
  );
}
