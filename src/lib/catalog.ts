import { z } from "zod";

import type { businessCategory } from "@/db/schema";
import { parseMoneyToCents } from "@/lib/product-validations";

type BusinessCategory = (typeof businessCategory.enumValues)[number];

export const CATALOG_PAGE_SIZE = 30;
export const CATALOG_MAX_SELECTION = 50;
export const CATALOG_ATTRIBUTION = "Parte de los datos provienen de Open Food Facts (openfoodfacts.org), bajo licencia ODbL.";

// Qué categorías mostrar primero según el rubro: no hay datos de ventas del
// catálogo, así que "lo más vendido" se aproxima con lo típico de cada rubro.
const KIOSK_FIRST = ["Alfajores", "Chocolates y bombones", "Caramelos y chupetines", "Gomitas", "Chicles", "Turrones", "Bebidas", "Snacks", "Galletitas", "Barritas de cereal", "Tostadas y grisines", "Artículos de kiosco"];
const GROCERY_FIRST = ["Almacén varios", "Lácteos y dulce de leche", "Yerba, té y café", "Fideos y arroz", "Aceites", "Azúcar y endulzantes", "Harinas y premezclas", "Tomate, salsas y aderezos", "Legumbres y conservas", "Bebidas", "Galletitas", "Sal, caldos y condimentos"];

export const CATALOG_CATEGORY_PRIORITY: Partial<Record<BusinessCategory, string[]>> = {
  KIOSK: KIOSK_FIRST,
  GROCERY: GROCERY_FIRST,
  DISTRIBUTOR: [...GROCERY_FIRST, ...KIOSK_FIRST],
  HEALTH_FOOD_STORE: ["Cereales", "Barritas de cereal", "Harinas y premezclas", "Yerba, té y café", "Legumbres y conservas", "Azúcar y endulzantes", "Galletitas"],
  BAKERY: ["Pan y budines", "Harinas y premezclas", "Postres y repostería", "Dulces y mermeladas", "Lácteos y dulce de leche", "Azúcar y endulzantes"],
};

export function catalogCategoryPriority(category: BusinessCategory | null | undefined) {
  return (category && CATALOG_CATEGORY_PRIORITY[category]) || KIOSK_FIRST.concat(GROCERY_FIRST);
}

// Nombre con el que se crea el producto: nombre + tamaño, sin repetir el tamaño
// si el nombre ya lo incluye.
export function catalogProductName(name: string, size: string | null | undefined) {
  const base = name.trim();
  const extra = size?.trim();
  if (!extra || base.toLowerCase().endsWith(extra.toLowerCase())) return base.slice(0, 160);
  return `${base} ${extra}`.slice(0, 160);
}

// Con una sola letra la búsqueda de texto devuelve casi todo: se busca desde
// dos caracteres. Los números (códigos de barras) se buscan siempre.
export function effectiveCatalogQuery(query: string) {
  const trimmed = query.trim();
  return trimmed.length >= 2 || /^[0-9]+$/.test(trimmed) ? trimmed : "";
}

// Palabras de búsqueda, con los comodines de LIKE escapados.
export function catalogSearchTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[\\%_]/g, (character) => `\\${character}`))
    .filter(Boolean)
    .slice(0, 6);
}

export const catalogSearchSchema = z.object({
  query: z.string().trim().max(80).catch(""),
  category: z.string().trim().max(80).nullable().catch(null).transform((value) => value || null),
  // null = según el rubro del negocio (activado en kioscos).
  kioskOnly: z.boolean().nullable().catch(null),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});
export type CatalogSearchInput = z.infer<typeof catalogSearchSchema>;

const optionalMoney = (label: string) => z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) return 0;
    const cents = parseMoneyToCents(value);
    if (!Number.isFinite(cents) || cents < 0) {
      context.addIssue({ code: "custom", message: `Ingresá un ${label} válido.` });
      return z.NEVER;
    }
    return cents;
  });

const optionalCount = (label: string) => z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) return 0;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 1_000_000_000) {
      context.addIssue({ code: "custom", message: `El ${label} tiene que ser un número entero, 0 o más.` });
      return z.NEVER;
    }
    return number;
  });

// Mismas reglas de dinero y stock que el alta de productos; el precio de compra
// es opcional (vacío = $0) y el stock puede quedar en 0.
export const catalogAddItemSchema = z.object({
  barcode: z.string().trim().regex(/^[0-9]{8,14}$/, "Código de barras inválido."),
  salePriceCents: z
    .string()
    .trim()
    .min(1, "Ingresá el precio de venta.")
    .transform(parseMoneyToCents)
    .refine(Number.isFinite, "Ingresá un precio de venta válido.")
    .refine((value) => value > 0, "El precio de venta tiene que ser mayor a $0."),
  costPriceCents: optionalMoney("precio de compra"),
  initialStock: optionalCount("stock inicial"),
  minimumStock: optionalCount("stock mínimo"),
});

export const catalogAddSchema = z
  .array(catalogAddItemSchema)
  .min(1, "Elegí al menos un producto.")
  .max(CATALOG_MAX_SELECTION, `Podés agregar hasta ${CATALOG_MAX_SELECTION} productos por vez.`);
export type CatalogAddItem = z.infer<typeof catalogAddItemSchema>;
