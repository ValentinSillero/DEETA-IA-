import { z } from "zod";

import { PRODUCT_IMPORT_FIELDS } from "@/lib/product-imports";

export const importMappingRequestSchema = z.object({
  mapping: z.record(z.string().regex(/^\d+$/), z.enum(PRODUCT_IMPORT_FIELDS)),
  existingStrategy: z.enum(["SKIP", "UPDATE_PRICES", "UPDATE_PRICES_STOCK"]),
});

export const importRowRequestSchema = z.object({
  included: z.boolean().optional(),
  overrides: z.object({
    NAME: z.string().max(160),
    BARCODE: z.string().max(80),
    COST_PRICE: z.string().max(60),
    SALE_PRICE: z.string().max(60),
    INITIAL_STOCK: z.string().max(30),
    MINIMUM_STOCK: z.string().max(30),
    DESCRIPTION: z.string().max(1000),
  }).optional(),
}).refine((value) => value.overrides || typeof value.included === "boolean");
