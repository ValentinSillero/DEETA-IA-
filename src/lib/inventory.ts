export type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "AVAILABLE";
export type EditableStockMovement = "IN" | "OUT" | "ADJUSTMENT";

export function stockStatus(currentStock: number, minimumStock: number): StockStatus {
  if (currentStock === 0) return "OUT_OF_STOCK";
  if (minimumStock > 0 && currentStock <= minimumStock) return "LOW_STOCK";
  return "AVAILABLE";
}

export function calculateStockMovement(
  currentStock: number,
  type: EditableStockMovement,
  amount: number,
) {
  if (!Number.isInteger(currentStock) || currentStock < 0) {
    throw new Error("INVALID_CURRENT_STOCK");
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const resultingStock =
    type === "IN" ? currentStock + amount : type === "OUT" ? currentStock - amount : amount;

  if (resultingStock < 0) throw new Error("NEGATIVE_STOCK");

  return {
    previousStock: currentStock,
    resultingStock,
    quantity: resultingStock - currentStock,
  };
}

export function resourceBelongsToBusiness(
  memberBusinessId: string,
  resourceBusinessId: string,
) {
  return memberBusinessId === resourceBusinessId;
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatMovementQuantity(quantity: number) {
  return `${quantity > 0 ? "+" : ""}${quantity}`;
}
