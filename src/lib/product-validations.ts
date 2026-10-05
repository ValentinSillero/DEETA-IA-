import { z } from "zod";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";

const MAX_MONEY_CENTS = 9_000_000_000_000;

export function parseMoneyToCents(raw: string) {
  const compact = raw.trim().replace(/[$\s]/g, "");
  if (!compact) return Number.NaN;
  const negative = compact.startsWith("-");
  const unsigned = negative ? compact.slice(1) : compact;

  let normalized = unsigned;
  if (unsigned.includes(",") && unsigned.includes(".")) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else if (unsigned.includes(",")) {
    normalized = unsigned.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) {
    normalized = unsigned.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  const [whole, decimals = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) return Number.NaN;
  return negative ? -cents : cents;
}

const moneyField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Ingresá el ${label}.`)
    .transform(parseMoneyToCents)
    .refine(Number.isFinite, `Ingresá un ${label} válido.`)
    .refine((value) => value >= 0, `El ${label} no puede ser negativo.`);

const nonnegativeInteger = (message: string) =>
  z.coerce.number().int("Ingresá un número entero.").min(0, message).max(1_000_000_000);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalBarcode = z
  .string()
  .transform(normalizeBarcode)
  .refine((value) => !value || isValidBarcode(value), "Ingresá un código de barras válido.")
  .transform((value) => value || null);

export const productCreateSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del producto.").max(160),
  description: optionalText(1000),
  costPriceCents: moneyField("precio de compra"),
  salePriceCents: moneyField("precio de venta"),
  initialStock: nonnegativeInteger("El stock inicial no puede ser negativo."),
  minimumStock: nonnegativeInteger("El stock mínimo no puede ser negativo."),
  barcode: optionalBarcode,
});

export const productEditSchema = productCreateSchema.omit({ initialStock: true });

export const stockMovementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("IN"),
    amount: z.coerce.number().int().positive("Ingresá cuántas unidades entraron."),
    reason: optionalText(300),
  }),
  z.object({
    type: z.literal("OUT"),
    amount: z.coerce.number().int().positive("Ingresá cuántas unidades querés quitar."),
    reason: optionalText(300),
  }),
  z.object({
    type: z.literal("ADJUSTMENT"),
    amount: nonnegativeInteger("La cantidad real no puede ser negativa."),
    reason: optionalText(300),
  }),
]);

export type ProductCreateInput = z.output<typeof productCreateSchema>;
export type ProductEditInput = z.output<typeof productEditSchema>;
export type StockMovementInput = z.output<typeof stockMovementSchema>;
