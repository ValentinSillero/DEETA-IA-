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

export const salePaymentLineSchema = z.object({
  method: z.enum(["CASH", "TRANSFER", "CARD", "CREDIT"]),
  amountCents: z.number().int().positive().max(100_000_000_000),
});

// Acepta el formato anterior (un solo medio por el total) o el nuevo, con el
// cobro dividido y fiado. El total real siempre se calcula en el servidor.
export const completeSaleSchema = z
  .object({
    items: z.array(cartItemSchema).min(1).max(200),
    paymentMethod: z.enum(["CASH", "TRANSFER", "CARD"]).optional(),
    payments: z.array(salePaymentLineSchema).min(1).max(4).optional(),
    receivedCashCents: z.number().int().nonnegative().nullable(),
    customerId: z.string().uuid().nullable().optional(),
    clientRequestId: z.string().uuid().nullable().optional(),
    pairingSessionId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (new Set(value.items.map((item) => item.productId)).size !== value.items.length) {
      context.addIssue({ code: "custom", message: "Hay productos repetidos en el carrito." });
    }
    if (Boolean(value.paymentMethod) === Boolean(value.payments)) {
      context.addIssue({ code: "custom", message: "Elegí cómo se paga la venta." });
      return;
    }
    if (value.payments && new Set(value.payments.map((line) => line.method)).size !== value.payments.length) {
      context.addIssue({ code: "custom", message: "Cada medio de pago puede aparecer una sola vez." });
    }
    const paysCash = value.paymentMethod === "CASH" || Boolean(value.payments?.some((line) => line.method === "CASH"));
    if (paysCash && value.receivedCashCents === null) {
      context.addIssue({ code: "custom", message: "Ingresá cuánto efectivo recibiste." });
    }
    if (value.payments?.some((line) => line.method === "CREDIT") && !value.customerId) {
      context.addIssue({ code: "custom", path: ["customerId"], message: "Elegí un cliente para registrar la deuda." });
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
