import { z } from "zod";

export const aiQuestionSchema = z.object({
  question: z.string().trim().min(2, "Escribí una pregunta.").max(800, "La pregunta es demasiado larga."),
  conversationId: z.string().uuid().nullable().optional(),
});

export const aiPeriodSchema = z.object({
  kind: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "CURRENT_MONTH", "PREVIOUS_MONTH", "SPECIFIC_MONTH"]),
  month: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
}).superRefine((value, context) => {
  if (value.kind === "SPECIFIC_MONTH" && !value.month) context.addIssue({ code: "custom", message: "El mes es obligatorio." });
  if (value.kind !== "SPECIFIC_MONTH" && value.month) context.addIssue({ code: "custom", message: "El mes solo corresponde a un período específico." });
});

export const slowMovingSchema = z.object({ days: z.number().int().min(7).max(90) });
export const productPerformanceSchema = z.object({ productReference: z.string().trim().min(1).max(120) });
