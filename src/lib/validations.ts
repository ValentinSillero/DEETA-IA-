import { z } from "zod";
import { BUSINESS_TIMEZONES } from "@/lib/constants";

const optionalPhone = z
  .string()
  .trim()
  .max(30, "El teléfono es demasiado largo")
  .refine((value) => !value || /^[+\d\s().-]+$/.test(value), "Ingresá un teléfono válido")
  .transform((value) => value || null);

export const businessSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del negocio").max(100),
  category: z.enum([
    "KIOSK",
    "GROCERY",
    "HARDWARE_STORE",
    "CLOTHING_STORE",
    "HEALTH_FOOD_STORE",
    "BAKERY",
    "DISTRIBUTOR",
    "OTHER",
  ]),
  city: z.string().trim().min(2, "Ingresá la ciudad").max(80),
  province: z.string().trim().min(2, "Ingresá la provincia").max(80),
  phone: optionalPhone,
  timezone: z.enum(BUSINESS_TIMEZONES.map((item) => item.value) as ["America/Argentina/Buenos_Aires", "America/Montevideo"]).default("America/Argentina/Buenos_Aires"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre").max(100),
});

export type BusinessInput = z.output<typeof businessSchema>;
