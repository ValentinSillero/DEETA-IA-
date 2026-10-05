import { z } from "zod";

import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";

const barcode = z.string().transform(normalizeBarcode).refine(isValidBarcode, "El código no es válido.");

export const lookupBarcodeSchema = z.object({ barcode });
export const createPairingSchema = z.object({ targetCartId: z.string().uuid() });
export const connectPairingSchema = z.object({ token: z.string().min(32).max(200) });
export const pairingIdSchema = z.string().uuid();
export const remoteScanSchema = z.object({
  pairingId: z.string().uuid(),
  eventId: z.string().uuid(),
  barcode,
  format: z.string().trim().max(40).nullable(),
});
