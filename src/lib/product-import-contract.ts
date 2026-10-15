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
