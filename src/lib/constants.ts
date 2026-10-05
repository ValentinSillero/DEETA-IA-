export const BUSINESS_CATEGORIES = [
  { value: "KIOSK", label: "Kiosco" },
  { value: "GROCERY", label: "Almacén" },
  { value: "HARDWARE_STORE", label: "Ferretería" },
  { value: "CLOTHING_STORE", label: "Tienda de ropa" },
  { value: "HEALTH_FOOD_STORE", label: "Dietética" },
  { value: "BAKERY", label: "Panadería" },
  { value: "DISTRIBUTOR", label: "Distribuidora" },
  { value: "OTHER", label: "Otro" },
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]["value"];

export function getCategoryLabel(value: string) {
  return BUSINESS_CATEGORIES.find((category) => category.value === value)?.label ?? "Otro";
}

export const BUSINESS_TIMEZONES = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Alquiler", "Luz", "Agua", "Internet", "Sueldos", "Transporte",
  "Limpieza", "Mantenimiento", "Impuestos", "Marketing", "Otros",
] as const;
