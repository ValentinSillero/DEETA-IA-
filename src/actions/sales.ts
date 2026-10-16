"use server";

import { revalidatePath } from "next/cache";

import { cancelSaleForUser, completeSaleForUser } from "@/data/sales";
import { cancelSaleSchema, completeSaleSchema } from "@/lib/sale-validations";
import { requireFreshSession } from "@/lib/session";

export type CompleteSaleActionResult =
  | { ok: true; saleId: string; totalCents: number }
  | { ok: false; message: string; code?: string };

export async function completeSaleAction(input: unknown): Promise<CompleteSaleActionResult> {
  const session = await requireFreshSession();
  const parsed = completeSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues.find((issue) => issue.path[0] === "customerId")?.message ?? "Revisá el carrito y el medio de pago." };

  try {
    const result = await completeSaleForUser(session.user.id, parsed.data);
    if (!result.ok) {
      const messages = {
        NO_BUSINESS: "No encontramos tu negocio.",
        OPEN_CASH_REQUIRED: "Primero tenés que abrir la caja.",
        INSUFFICIENT_PAYMENT: "El efectivo recibido no alcanza para cobrar la venta.",
        PAYMENT_MISMATCH: "Los montos del pago no suman el total de la venta.",
        CUSTOMER_REQUIRED: "Elegí un cliente para registrar la deuda.",
        INVALID_PRODUCTS_OR_STOCK: "Cambió el stock de uno de los productos. Revisá el carrito.",
      } as const;
      return { ok: false, message: messages[result.reason], code: result.reason };
    }
    revalidatePath("/dashboard");
    revalidatePath("/productos");
    revalidatePath("/ventas");
    revalidatePath("/caja");
    revalidatePath("/clientes");
    return result;
  } catch (error) {
    console.error("No se pudo completar la venta", error);
    return { ok: false, message: "No pudimos guardar la venta. No se realizó ningún cambio." };
  }
}

export type CancelSaleState = { status: "idle" | "success" | "error"; message?: string };

export async function cancelSaleAction(
  _previousState: CancelSaleState,
  formData: FormData,
): Promise<CancelSaleState> {
  const session = await requireFreshSession();
  const parsed = cancelSaleSchema.safeParse({
    saleId: String(formData.get("saleId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: "No pudimos validar la venta." };

  try {
    const result = await cancelSaleForUser(session.user.id, parsed.data.saleId, parsed.data.reason);
    if (!result.ok) {
      const messages = {
        CASH_SESSION_CLOSED: "No se puede cancelar una venta en efectivo después de cerrar su caja.",
        ALREADY_CANCELLED: "La venta ya estaba cancelada.",
        NOT_FOUND: "No pudimos encontrar esa venta.",
        CREDIT_ALREADY_PAID: "No se puede cancelar: el cliente ya pagó parte de lo fiado en esta venta. Si hace falta corregir el saldo, registrá un ajuste en su cuenta.",
      } as const;
      const message = messages[result.reason];
      return { status: "error", message };
    }
    revalidatePath("/dashboard");
    revalidatePath("/productos");
    revalidatePath("/ventas");
    revalidatePath(`/ventas/${parsed.data.saleId}`);
    revalidatePath("/caja");
    revalidatePath("/clientes");
    return { status: "success", message: "Venta cancelada. El stock, los cobros y la deuda fueron revertidos." };
  } catch (error) {
    console.error("No se pudo cancelar la venta", error);
    return { status: "error", message: "No pudimos cancelar la venta. Intentá nuevamente." };
  }
}
