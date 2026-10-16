import { z } from "zod";

import { parseMoneyToCents } from "@/lib/product-validations";

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).transform((value) => value || null);

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del cliente.").max(120, "El nombre es demasiado largo."),
  phone: optionalText(40, "El teléfono es demasiado largo.")
    .refine((value) => value === null || /^[\d\s()+-]{6,40}$/.test(value), "Ingresá un teléfono válido."),
  email: optionalText(160, "El email es demasiado largo.")
    .refine((value) => value === null || z.email().safeParse(value).success, "Ingresá un email válido."),
  document: optionalText(30, "El documento es demasiado largo."),
  notes: optionalText(500, "Las notas son demasiado largas."),
});

export const quickCustomerSchema = customerSchema.pick({ name: true, phone: true });

const positiveMoney = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Ingresá ${label}.`)
    .transform(parseMoneyToCents)
    .refine(Number.isFinite, `Ingresá ${label} válido.`)
    .refine((value) => value > 0, `${label[0].toUpperCase()}${label.slice(1)} tiene que ser mayor a cero.`);

export const customerPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amountCents: positiveMoney("el monto del pago"),
  method: z.enum(["CASH", "TRANSFER", "CARD"], { message: "Elegí cómo pagó." }),
  note: optionalText(200, "La nota es demasiado larga."),
  idempotencyKey: z.string().uuid(),
});

export const customerAdjustmentSchema = z.object({
  customerId: z.string().uuid(),
  direction: z.enum(["INCREASE", "DECREASE"], { message: "Elegí si la deuda sube o baja." }),
  amountCents: positiveMoney("el monto del ajuste"),
  reason: z.string().trim().min(3, "Contá el motivo del ajuste.").max(200, "El motivo es demasiado largo."),
  idempotencyKey: z.string().uuid(),
});

export type CustomerInput = z.output<typeof customerSchema>;
export type QuickCustomerInput = z.output<typeof quickCustomerSchema>;
export type CustomerPaymentInput = z.output<typeof customerPaymentSchema>;
export type CustomerAdjustmentInput = z.output<typeof customerAdjustmentSchema>;

// Convención única de signos de la cuenta corriente.
export function signedMovementAmount(type: "CREDIT_SALE" | "PAYMENT" | "SALE_CANCELLATION" | "ADJUSTMENT", amountCents: number, direction?: "INCREASE" | "DECREASE") {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("INVALID_AMOUNT");
  if (type === "CREDIT_SALE") return amountCents;
  if (type === "PAYMENT" || type === "SALE_CANCELLATION") return -amountCents;
  if (!direction) throw new Error("DIRECTION_REQUIRED");
  return direction === "INCREASE" ? amountCents : -amountCents;
}

export function balanceAfterMovement(balanceCents: number, signedAmountCents: number) {
  const next = balanceCents + signedAmountCents;
  if (next < 0) throw new Error("NEGATIVE_BALANCE");
  return next;
}

export function balanceFromMovements(movements: Array<{ amountCents: number }>) {
  return movements.reduce((balance, movement) => balance + movement.amountCents, 0);
}
