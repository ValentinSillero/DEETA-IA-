import { z } from "zod";

import { parseMoneyToCents } from "@/lib/product-validations";

const amount = z.string().trim().min(1, "Ingresá cuánto pagaste.")
  .transform(parseMoneyToCents)
  .refine((value) => Number.isSafeInteger(value) && value > 0, "Ingresá un monto mayor a cero.");

export const createExpenseSchema = z.object({
  description: z.string().trim().min(2, "Contanos en qué gastaste.").max(200),
  amountCents: amount,
  categoryId: z.string().uuid("Elegí una categoría."),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha válida."),
});

export const cancelExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  reason: z.string().trim().max(300).transform((value) => value || null),
});

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre.").max(80),
});

export const updateExpenseCategorySchema = expenseCategorySchema.extend({ categoryId: z.string().uuid() });
export const toggleExpenseCategorySchema = z.object({ categoryId: z.string().uuid(), isActive: z.boolean() });

export type CreateExpenseInput = z.output<typeof createExpenseSchema>;
