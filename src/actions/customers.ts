"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  adjustCustomerBalanceForUser,
  createCustomerForUser,
  registerCustomerPaymentForUser,
  searchCustomersForUser,
  setCustomerActiveForUser,
  updateCustomerForUser,
  type CustomerListItem,
} from "@/data/customers";
import {
  customerAdjustmentSchema,
  customerPaymentSchema,
  customerSchema,
  quickCustomerSchema,
} from "@/lib/customer-validations";
import { requireFreshSession } from "@/lib/session";
import { permissionDenied } from "@/lib/action-guard";

export type CustomerFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

function customerValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    document: String(formData.get("document") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function revalidateCustomer(customerId?: string) {
  revalidatePath("/clientes");
  if (customerId) revalidatePath(`/clientes/${customerId}`);
  revalidatePath("/dashboard");
}

export async function createCustomerAction(_state: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const session = await requireFreshSession();
  const denied = await permissionDenied(session.user.id, "CUSTOMER_EDIT");
  if (denied) return { status: "error", message: denied };
  const parsed = customerSchema.safeParse(customerValues(formData));
  if (!parsed.success) return { status: "error", message: "Revisá los datos marcados.", errors: parsed.error.flatten().fieldErrors };
  let customerId: string | null = null;
  try {
    customerId = (await createCustomerForUser(session.user.id, parsed.data))?.id ?? null;
  } catch (error) {
    console.error("No se pudo crear el cliente", error);
  }
  if (!customerId) return { status: "error", message: "No pudimos crear el cliente. Intentá nuevamente." };
  revalidateCustomer();
  redirect(`/clientes/${customerId}`);
}

export async function updateCustomerAction(_state: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const session = await requireFreshSession();
  const denied = await permissionDenied(session.user.id, "CUSTOMER_EDIT");
  if (denied) return { status: "error", message: denied };
  const customerId = String(formData.get("customerId") ?? "");
  const parsed = customerSchema.safeParse(customerValues(formData));
  if (!parsed.success) return { status: "error", message: "Revisá los datos marcados.", errors: parsed.error.flatten().fieldErrors };
  const updated = await updateCustomerForUser(session.user.id, customerId, parsed.data).catch(() => false);
  if (!updated) return { status: "error", message: "No pudimos guardar los cambios." };
  revalidateCustomer(customerId);
  redirect(`/clientes/${customerId}`);
}

export async function setCustomerActiveAction(_state: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const session = await requireFreshSession();
  const denied = await permissionDenied(session.user.id, "CUSTOMER_DEACTIVATE");
  if (denied) return { status: "error", message: denied };
  const customerId = String(formData.get("customerId") ?? "");
  const active = formData.get("active") === "true";
  const result = await setCustomerActiveForUser(session.user.id, customerId, active);
  if (!result.ok) {
    const messages = {
      HAS_DEBT: "Este cliente todavía tiene deuda pendiente.",
      FORBIDDEN: "Solo quien administra el negocio puede hacer este cambio.",
      NOT_FOUND: "No encontramos este cliente.",
    } as const;
    return { status: "error", message: messages[result.reason] };
  }
  revalidateCustomer(customerId);
  return { status: "success", message: active ? "El cliente volvió a estar activo." : "El cliente quedó desactivado. Su historial se conserva." };
}

export type CustomerPaymentState = CustomerFormState & { balanceCents?: number };

export async function registerCustomerPaymentAction(_state: CustomerPaymentState, formData: FormData): Promise<CustomerPaymentState> {
  const session = await requireFreshSession();
  const denied = await permissionDenied(session.user.id, "CUSTOMER_PAYMENT");
  if (denied) return { status: "error", message: denied };
  const parsed = customerPaymentSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    amountCents: String(formData.get("amount") ?? ""),
    method: String(formData.get("method") ?? ""),
    note: String(formData.get("note") ?? ""),
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: "Revisá el pago.", errors: parsed.error.flatten().fieldErrors };
  try {
    const result = await registerCustomerPaymentForUser(session.user.id, parsed.data);
    if (!result.ok) {
      const messages = {
        EXCEEDS_BALANCE: "El pago no puede superar la deuda pendiente.",
        NO_DEBT: "Este cliente no tiene deuda pendiente.",
        OPEN_CASH_REQUIRED: "Para registrar un pago en efectivo primero tenés que abrir la caja.",
        NOT_FOUND: "No encontramos este cliente.",
      } as const;
      return { status: "error", message: messages[result.reason] };
    }
    revalidateCustomer(parsed.data.customerId);
    revalidatePath("/caja");
    return { status: "success", message: "Pago registrado.", balanceCents: result.balanceCents };
  } catch (error) {
    console.error("No se pudo registrar el pago", error);
    return { status: "error", message: "No pudimos registrar el pago. No se realizó ningún cambio." };
  }
}

export async function adjustCustomerBalanceAction(_state: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const session = await requireFreshSession();
  const denied = await permissionDenied(session.user.id, "CUSTOMER_ADJUSTMENT");
  if (denied) return { status: "error", message: denied };
  const parsed = customerAdjustmentSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    direction: String(formData.get("direction") ?? ""),
    amountCents: String(formData.get("amount") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: "Revisá el ajuste.", errors: parsed.error.flatten().fieldErrors };
  const result = await adjustCustomerBalanceForUser(session.user.id, parsed.data).catch(() => null);
  if (!result) return { status: "error", message: "No pudimos registrar el ajuste." };
  if (!result.ok) {
    const messages = {
      NEGATIVE_BALANCE: "El ajuste no puede dejar el saldo por debajo de cero.",
      FORBIDDEN: "Solo quien administra el negocio puede registrar ajustes.",
      NOT_FOUND: "No encontramos este cliente.",
    } as const;
    return { status: "error", message: messages[result.reason] };
  }
  revalidateCustomer(parsed.data.customerId);
  return { status: "success", message: "Ajuste registrado." };
}

export async function searchCustomersAction(query: string): Promise<CustomerListItem[]> {
  const session = await requireFreshSession();
  const denied = await permissionDenied(session.user.id, "CUSTOMER_VIEW");
  if (denied) return [];
  return searchCustomersForUser(session.user.id, String(query ?? "").slice(0, 80));
}

export type QuickCustomerResult = { ok: true; customer: CustomerListItem } | { ok: false; message: string };

export async function quickCreateCustomerAction(input: { name: string; phone: string }): Promise<QuickCustomerResult> {
  const session = await requireFreshSession();
  const denied = await permissionDenied(session.user.id, "CUSTOMER_EDIT");
  if (denied) return { ok: false, message: denied };
  const parsed = quickCustomerSchema.safeParse({ name: String(input?.name ?? ""), phone: String(input?.phone ?? "") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisá los datos del cliente." };
  const customer = await createCustomerForUser(session.user.id, parsed.data).catch(() => null);
  if (!customer) return { ok: false, message: "No pudimos crear el cliente." };
  revalidatePath("/clientes");
  return { ok: true, customer };
}
