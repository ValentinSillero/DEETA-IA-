"use server";

import { revalidatePath } from "next/cache";

import { closeCashForUser, openCashForUser } from "@/data/cash";
import { closeCashSchema, openCashSchema } from "@/lib/sale-validations";
import { requireFreshSession } from "@/lib/session";

export type CashFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  differenceCents?: number;
};

export async function openCashAction(
  _previousState: CashFormState,
  formData: FormData,
): Promise<CashFormState> {
  const session = await requireFreshSession();
  const parsed = openCashSchema.safeParse({ openingAmountCents: String(formData.get("openingAmountCents") ?? "") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  try {
    const result = await openCashForUser(session.user.id, parsed.data.openingAmountCents);
    if (!result.ok) return { status: "error", message: result.reason === "ALREADY_OPEN" ? "Ya hay una caja abierta." : "No encontramos tu negocio." };
    revalidatePath("/caja");
    revalidatePath("/dashboard");
    return { status: "success", message: "Caja abierta. Ya podés cobrar en efectivo." };
  } catch (error) {
    console.error("No se pudo abrir la caja", error);
    return { status: "error", message: "No pudimos abrir la caja. Intentá nuevamente." };
  }
}

export async function closeCashAction(
  _previousState: CashFormState,
  formData: FormData,
): Promise<CashFormState> {
  const session = await requireFreshSession();
  const parsed = closeCashSchema.safeParse({
    cashSessionId: String(formData.get("cashSessionId") ?? ""),
    declaredCashCents: String(formData.get("declaredCashCents") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  try {
    const result = await closeCashForUser(session.user.id, parsed.data.cashSessionId, parsed.data.declaredCashCents);
    if (!result.ok) return { status: "error", message: "La caja ya estaba cerrada o no existe." };
    revalidatePath("/caja");
    revalidatePath(`/caja/${parsed.data.cashSessionId}`);
    revalidatePath("/dashboard");
    return {
      status: "success",
      differenceCents: result.differenceCents,
      message: result.differenceCents === 0 ? "La caja cerró correctamente." : "Caja cerrada. Guardamos la diferencia real.",
    };
  } catch (error) {
    console.error("No se pudo cerrar la caja", error);
    return { status: "error", message: "No pudimos cerrar la caja. Intentá nuevamente." };
  }
}
