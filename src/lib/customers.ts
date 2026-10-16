import type { CustomerMovementType, PaymentMethod } from "@/db/schema";

const paymentLabels: Partial<Record<PaymentMethod, string>> = { CASH: "en efectivo", TRANSFER: "por transferencia", CARD: "con tarjeta" };

export function customerMovementLabel(type: CustomerMovementType, amountCents: number, paymentMethod: PaymentMethod | null) {
  if (type === "CREDIT_SALE") return "Venta fiada";
  if (type === "PAYMENT") return `Pago ${paymentMethod ? paymentLabels[paymentMethod] ?? "" : ""}`.trim();
  if (type === "SALE_CANCELLATION") return "Venta fiada cancelada";
  return amountCents > 0 ? "Ajuste: sube la deuda" : "Ajuste: baja la deuda";
}

export function customerStatus(balanceCents: number) {
  return balanceCents > 0 ? { debt: true as const, label: "Debe" } : { debt: false as const, label: "Al día" };
}

// "hoy", "ayer", "hace 3 días", "hace 2 meses": lectura rápida sin calendario.
export function relativeDaysLabel(date: Date | null, now: Date = new Date()) {
  if (!date) return "Sin movimientos";
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}
