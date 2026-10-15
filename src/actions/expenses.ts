"use server";

import { revalidatePath } from "next/cache";

import {
  cancelExpenseForUser,
  createExpenseCategoryForUser,
  createExpenseForUser,
  toggleExpenseCategoryForUser,
  updateExpenseCategoryForUser,
} from "@/data/expenses";
import {
  cancelExpenseSchema,
  createExpenseSchema,
  expenseCategorySchema,
  toggleExpenseCategorySchema,
  updateExpenseCategorySchema,
} from "@/lib/expense-validations";
import { requireFreshSession } from "@/lib/session";

export type ExpenseFormState = { status: "idle" | "success" | "error"; message?: string; expenseId?: string; unlinkedCash?: boolean; errors?: Record<string, string[]> };

export async function createExpenseAction(_previous: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const session = await requireFreshSession();
  const parsed = createExpenseSchema.safeParse({
    description: String(formData.get("description") ?? ""), amountCents: String(formData.get("amountCents") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""), paymentMethod: String(formData.get("paymentMethod") ?? ""),
    expenseDate: String(formData.get("expenseDate") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: "Revisá los datos marcados.", errors: parsed.error.flatten().fieldErrors };
  try {
    const result = await createExpenseForUser(session.user.id, parsed.data);
    if (!result.ok) return { status: "error", message: result.reason === "INVALID_CATEGORY" ? "Esa categoría ya no está disponible." : result.reason === "INVALID_DATE" ? "La fecha no puede ser futura." : "No encontramos tu negocio." };
    revalidatePath("/dashboard"); revalidatePath("/gastos"); revalidatePath("/analisis"); revalidatePath("/caja");
    const unlinkedCash = parsed.data.paymentMethod === "CASH" && !result.linkedToCash;
    return {
      status: "success", expenseId: result.id, unlinkedCash,
      message: unlinkedCash ? "Gasto guardado. Como no hay una caja abierta, no se asoció al efectivo de una caja." : "Gasto guardado correctamente.",
    };
  } catch (error) {
    console.error("No se pudo guardar el gasto", error);
    return { status: "error", message: "No pudimos guardar el gasto. No se realizó ningún cambio." };
  }
}

export type ExpenseMutationState = { status: "idle" | "success" | "error"; message?: string };

export async function cancelExpenseAction(_previous: ExpenseMutationState, formData: FormData): Promise<ExpenseMutationState> {
  const session = await requireFreshSession();
  const parsed = cancelExpenseSchema.safeParse({ expenseId: String(formData.get("expenseId") ?? ""), reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) return { status: "error", message: "No pudimos validar el gasto." };
  const result = await cancelExpenseForUser(session.user.id, parsed.data.expenseId, parsed.data.reason);
  if (!result.ok) {
    const messages = { NOT_FOUND: "No encontramos ese gasto.", ALREADY_CANCELLED: "El gasto ya estaba cancelado.", FORBIDDEN: "No tenés permiso para cancelar este gasto." };
    return { status: "error", message: messages[result.reason] };
  }
  revalidatePath("/dashboard"); revalidatePath("/gastos"); revalidatePath(`/gastos/${parsed.data.expenseId}`); revalidatePath("/analisis"); revalidatePath("/caja");
  return { status: "success", message: result.cashRestored ? "Gasto cancelado y efectivo devuelto a la caja esperada." : "Gasto cancelado. Se conservó el registro." };
}

export async function createExpenseCategoryAction(_previous: ExpenseMutationState, formData: FormData): Promise<ExpenseMutationState> {
  const session = await requireFreshSession();
  const parsed = expenseCategorySchema.safeParse({ name: String(formData.get("name") ?? "") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  try {
    const id = await createExpenseCategoryForUser(session.user.id, parsed.data.name);
    if (!id) return { status: "error", message: "Ya existe esa categoría o no tenés permiso." };
    revalidatePath("/gastos/categorias"); revalidatePath("/gastos/nuevo");
    return { status: "success", message: "Categoría creada." };
  } catch { return { status: "error", message: "No pudimos crear la categoría." }; }
}

export async function updateExpenseCategoryAction(_previous: ExpenseMutationState, formData: FormData): Promise<ExpenseMutationState> {
  const session = await requireFreshSession();
  const parsed = updateExpenseCategorySchema.safeParse({ categoryId: String(formData.get("categoryId") ?? ""), name: String(formData.get("name") ?? "") });
  if (!parsed.success) return { status: "error", message: "Revisá el nombre." };
  try {
    const updated = await updateExpenseCategoryForUser(session.user.id, parsed.data.categoryId, parsed.data.name);
    if (!updated) return { status: "error", message: "No pudimos actualizar la categoría." };
    revalidatePath("/gastos/categorias"); revalidatePath("/gastos");
    return { status: "success", message: "Categoría actualizada." };
  } catch { return { status: "error", message: "Ya existe una categoría con ese nombre." }; }
}

export async function toggleExpenseCategoryAction(formData: FormData) {
  const session = await requireFreshSession();
  const parsed = toggleExpenseCategorySchema.safeParse({ categoryId: String(formData.get("categoryId") ?? ""), isActive: String(formData.get("isActive")) === "true" });
  if (parsed.success) await toggleExpenseCategoryForUser(session.user.id, parsed.data.categoryId, parsed.data.isActive);
  revalidatePath("/gastos/categorias"); revalidatePath("/gastos/nuevo");
}
