import type { PaymentMethod, SalePaymentMethod } from "@/db/schema";

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
  CREDIT: "Fiado",
  MIXED: "Pago dividido",
};

export const SALE_PAYMENT_LABELS: Record<SalePaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  CREDIT: "Fiado",
};

export type SalePaymentLine = { method: SalePaymentMethod; amountCents: number };

// Separa lo vendido de lo cobrado: el fiado es venta, pero no entra a caja.
export function summarizeSalePayments(payments: SalePaymentLine[]) {
  const amount = (method: SalePaymentMethod) => payments.filter((line) => line.method === method).reduce((total, line) => total + line.amountCents, 0);
  const cashCents = amount("CASH");
  const creditCents = amount("CREDIT");
  const totalCents = payments.reduce((total, line) => total + line.amountCents, 0);
  const primaryMethod: PaymentMethod = payments.length === 1 ? payments[0].method : "MIXED";
  return { cashCents, creditCents, collectedCents: totalCents - creditCents, totalCents, primaryMethod };
}

export type SalePaymentIssue = "EMPTY" | "DUPLICATE_METHOD" | "INVALID_AMOUNT" | "TOTAL_MISMATCH" | "CUSTOMER_REQUIRED";

export function salePaymentIssue(totalCents: number, payments: SalePaymentLine[], customerId: string | null): SalePaymentIssue | null {
  if (payments.length === 0) return "EMPTY";
  if (new Set(payments.map((line) => line.method)).size !== payments.length) return "DUPLICATE_METHOD";
  if (payments.some((line) => !Number.isInteger(line.amountCents) || line.amountCents <= 0)) return "INVALID_AMOUNT";
  const summary = summarizeSalePayments(payments);
  if (summary.totalCents !== totalCents) return "TOTAL_MISMATCH";
  if (summary.creditCents > 0 && !customerId) return "CUSTOMER_REQUIRED";
  return null;
}
