import { z } from "zod";

import { parseMoneyToCents } from "@/lib/product-validations";

const moneyInput = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Ingresá ${label}.`)
    .transform(parseMoneyToCents)
    .refine(Number.isFinite, `Ingresá ${label} válido.`)
    .refine((value) => value >= 0, `${label} no puede ser negativo.`);

export const openCashSchema = z.object({
  openingAmountCents: moneyInput("el dinero inicial"),
});

export const closeCashSchema = z.object({
  cashSessionId: z.string().uuid(),
  declaredCashCents: moneyInput("el efectivo contado"),
});

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(1_000_000),
});

export const completeSaleSchema = z
  .object({
    items: z.array(cartItemSchema).min(1).max(200),
    paymentMethod: z.enum(["CASH", "TRANSFER", "CARD"]),
    receivedCashCents: z.number().int().nonnegative().nullable(),
    pairingSessionId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (new Set(value.items.map((item) => item.productId)).size !== value.items.length) {
      context.addIssue({ code: "custom", message: "Hay productos repetidos en el carrito." });
    }
    if (value.paymentMethod === "CASH" && value.receivedCashCents === null) {
      context.addIssue({ code: "custom", message: "Ingresá cuánto efectivo recibiste." });
    }
  });

export const cancelSaleSchema = z.object({
  saleId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(300)
    .transform((value) => value || null),
});

export type CompleteSaleInput = z.output<typeof completeSaleSchema>;
