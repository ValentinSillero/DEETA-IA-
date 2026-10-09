import { z } from "zod";

export const aiQuestionSchema = z.object({
  question: z.string().trim().min(2, "Escribí una pregunta.").max(800, "La pregunta es demasiado larga."),
  conversationId: z.string().uuid().nullable().optional(),
});

export const aiPeriodSchema = z.object({
  kind: z.enum(["TODAY", "YESTERDAY", "CURRENT_WEEK", "PREVIOUS_WEEK", "LAST_7_DAYS", "LAST_30_DAYS", "CURRENT_MONTH", "PREVIOUS_MONTH", "CURRENT_YEAR", "SPECIFIC_MONTH", "CUSTOM_RANGE"]),
  month: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).superRefine((value, context) => {
  if (value.kind === "SPECIFIC_MONTH" && !value.month) context.addIssue({ code: "custom", message: "El mes es obligatorio." });
  if (value.kind !== "SPECIFIC_MONTH" && value.month) context.addIssue({ code: "custom", message: "El mes solo corresponde a un período específico." });
  if (value.kind === "CUSTOM_RANGE" && (!value.start || !value.end)) context.addIssue({ code: "custom", message: "El rango necesita fecha inicial y final." });
  if (value.kind !== "CUSTOM_RANGE" && (value.start || value.end)) context.addIssue({ code: "custom", message: "Las fechas solo corresponden a un rango personalizado." });
});

export const slowMovingSchema = z.object({ days: z.number().int().min(7).max(90) });
export const productPerformanceSchema = z.object({ productReference: z.string().trim().min(1).max(120) });
export const inventoryAnalysisSchema = z.object({
  focus: z.enum(["REORDER", "SLOW", "EXCESS", "LOW_STOCK", "LOWEST_STOCK", "OUT_OF_STOCK", "BELOW_MINIMUM"]),
  days: z.union([z.literal(7), z.literal(30), z.literal(60)]),
});
export const productSalesRankingSchema = aiPeriodSchema.and(z.object({
  ranking: z.enum(["MOST_UNITS", "LEAST_UNITS", "MOST_REVENUE", "LEAST_REVENUE", "NO_SALES"]),
  limit: z.union([z.literal(1), z.literal(5), z.literal(8)]).optional().default(5),
}));
export const salesPatternsSchema = aiPeriodSchema.and(z.object({
  focus: z.enum(["DAYS", "HOURS", "TREND"]),
}));
