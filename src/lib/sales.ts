import type { PaymentMethod } from "@/db/schema";

export function stockAfterSale(currentStock: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
  if (quantity > currentStock) throw new Error("INSUFFICIENT_STOCK");
  return currentStock - quantity;
}

export function stockAfterCancellation(currentStock: number, soldQuantity: number) {
  if (!Number.isInteger(soldQuantity) || soldQuantity <= 0) throw new Error("INVALID_QUANTITY");
  return currentStock + soldQuantity;
}

export function expectedCashAfterSale(
  currentExpectedCents: number,
  saleTotalCents: number,
  paymentMethod: PaymentMethod,
) {
  return paymentMethod === "CASH"
    ? currentExpectedCents + saleTotalCents
    : currentExpectedCents;
}

export function cashDifference(expectedCents: number, declaredCents: number) {
  return declaredCents - expectedCents;
}

export function cashChange(totalCents: number, receivedCents: number) {
  if (receivedCents < totalCents) throw new Error("INSUFFICIENT_PAYMENT");
  return receivedCents - totalCents;
}

export function saleDisplayNumber(id: string) {
  return id.replaceAll("-", "").slice(-6).toUpperCase();
}

export function saleRequestRows(items: Array<{ productId: string; quantity: number }>) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    item_id: crypto.randomUUID(),
    movement_id: crypto.randomUUID(),
  }));
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
};
