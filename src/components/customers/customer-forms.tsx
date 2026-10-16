"use client";

import { CircleCheck } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import {
  adjustCustomerBalanceAction,
  registerCustomerPaymentAction,
  setCustomerActiveAction,
  type CustomerFormState,
  type CustomerPaymentState,
} from "@/actions/customers";
import { Field } from "@/components/forms/field";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import { formatMoney } from "@/lib/inventory";
import { parseMoneyToCents } from "@/lib/product-validations";

const initial: CustomerFormState = { status: "idle" };

type CustomerFormValues = { id?: string; name: string; phone: string | null; email: string | null; document: string | null; notes: string | null };

export function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  customer?: CustomerFormValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  const error = (field: string) => state.errors?.[field]?.[0];
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {customer?.id && <input type="hidden" name="customerId" value={customer.id} />}
      <Field label="Nombre" name="name" autoComplete="off" required defaultValue={customer?.name} placeholder="Ej. Juan Pérez" error={error("name")} autoFocus={!customer} />
      <Field label="Teléfono (opcional)" name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={customer?.phone ?? ""} placeholder="Ej. 341 555 1234" error={error("phone")} />
      <details className="rounded-lg border border-line px-4 py-1" open={Boolean(customer?.email || customer?.document || customer?.notes)}>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-muted">Más datos (opcional)</summary>
        <div className="grid gap-4 pb-4 pt-2">
          <Field label="Email" name="email" type="email" inputMode="email" autoComplete="off" spellCheck={false} defaultValue={customer?.email ?? ""} error={error("email")} />
          <Field label="Documento" name="document" autoComplete="off" defaultValue={customer?.document ?? ""} error={error("document")} />
          <label className="field-label">Notas<textarea name="notes" rows={3} maxLength={500} defaultValue={customer?.notes ?? ""} className="field-input py-3" placeholder="Ej. Vecino de la esquina, paga los viernes." /></label>
        </div>
      </details>
      {state.status === "error" && state.message && <p className="notice-error" role="alert">{state.message}</p>}
      <ActionSubmitButton className="button-primary w-full">{submitLabel}</ActionSubmitButton>
    </form>
  );
}

const paymentInitial: CustomerPaymentState = { status: "idle" };
const methods = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CARD", label: "Tarjeta" },
] as const;

export function CustomerPaymentForm({ customerId, balanceCents, hasOpenCash, initialKey }: { customerId: string; balanceCents: number; hasOpenCash: boolean; initialKey: string }) {
  const [state, formAction] = useActionState(registerCustomerPaymentAction, paymentInitial);
  // La primera clave viene del servidor (sin diferencias de hidratación) y se
  // renueva después de cada respuesta. Un doble envío del mismo formulario
  // reutiliza la clave y el servidor no registra el pago dos veces.
  const idempotencyKey = useMemo(() => (state === paymentInitial ? initialKey : crypto.randomUUID()), [state, initialKey]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof methods)[number]["value"]>("CASH");
  const currentBalance = state.status === "success" && state.balanceCents !== undefined ? state.balanceCents : balanceCents;
  const amountCents = amount ? parseMoneyToCents(amount) : Number.NaN;
  const valid = Number.isFinite(amountCents) && amountCents > 0;
  const exceeds = valid && amountCents > currentBalance;
  const newBalance = valid && !exceeds ? currentBalance - amountCents : null;

  if (currentBalance === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="status text-sm text-success"><CircleCheck className="size-4" aria-hidden="true" /> Al día</p>
        <p className="mt-1 text-sm text-muted">{state.status === "success" ? "Pago registrado. El cliente no tiene deuda pendiente." : "Este cliente no tiene deuda pendiente."}</p>
      </div>
    );
  }

  return (
    <form action={(formData) => { formAction(formData); setAmount(""); }} className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="registrar-pago">
      <h2 id="registrar-pago" className="section-title">Registrar pago</h2>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="method" value={method} />
      <div className="ledger mt-2">
        <div className="ledger-row"><span>Debe</span><span className="ledger-fill" aria-hidden="true" /><span>{formatMoney(currentBalance)}</span></div>
      </div>
      <label className="field-label mt-3">Monto que paga
        <input name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" className="field-input figure min-h-14 text-xl" placeholder="$ 0" aria-invalid={exceeds} />
      </label>
      <button type="button" onClick={() => setAmount(String(currentBalance / 100).replace(".", ","))} className="button-quiet mt-1 min-h-10 px-2 text-sm">Paga todo ({formatMoney(currentBalance)})</button>
      <fieldset className="mt-3">
        <legend className="text-sm font-semibold">¿Cómo pagó?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {methods.map((option) => (
            <button key={option.value} type="button" aria-pressed={method === option.value} onClick={() => setMethod(option.value)} className={`min-h-12 rounded-lg border px-2 text-sm font-semibold transition-colors ${method === option.value ? "border-ink bg-ink text-white" : "border-line-strong hover:bg-surface-2"}`}>{option.label}</button>
          ))}
        </div>
      </fieldset>
      {method === "CASH" && !hasOpenCash && <p className="notice-warning mt-3">Para cobrar en efectivo primero abrí la caja. También podés registrarlo como transferencia o tarjeta.</p>}
      {exceeds && <p className="field-error mt-3">El pago no puede superar la deuda pendiente.</p>}
      {newBalance !== null && (
        <div className="ledger mt-3"><div className="ledger-total"><span className="font-semibold">Nuevo saldo</span><span className="figure text-xl">{formatMoney(newBalance)}</span></div></div>
      )}
      <label className="field-label mt-3">Nota (opcional)<input name="note" maxLength={200} autoComplete="off" className="field-input" placeholder="Ej. pagó a cuenta" /></label>
      {state.message && <p className={`mt-3 ${state.status === "success" ? "notice-success" : "notice-error"}`} role="status">{state.message}</p>}
      <ActionSubmitButton className="button-primary mt-4 w-full" pendingLabel="Registrando…">Registrar pago</ActionSubmitButton>
    </form>
  );
}

export function CustomerAdjustmentForm({ customerId, initialKey }: { customerId: string; initialKey: string }) {
  const [state, formAction] = useActionState(adjustCustomerBalanceAction, initial);
  const idempotencyKey = useMemo(() => (state === initial ? initialKey : crypto.randomUUID()), [state, initialKey]);
  return (
    <details className="rounded-2xl border border-line bg-surface px-5 py-1">
      <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">Corregir saldo</summary>
      <form action={formAction} className="grid gap-3 pb-5 pt-1">
        <p className="text-sm leading-6 text-muted">Usalo solo para corregir errores o cargar una deuda anterior a DEETA. Queda registrado en el historial con su motivo.</p>
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">Tipo de ajuste</legend>
          <label className="flex min-h-12 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold"><input type="radio" name="direction" value="INCREASE" defaultChecked /> Sube la deuda</label>
          <label className="flex min-h-12 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm font-semibold"><input type="radio" name="direction" value="DECREASE" /> Baja la deuda</label>
        </fieldset>
        <Field label="Monto" name="amount" inputMode="decimal" autoComplete="off" placeholder="$ 0" error={state.errors?.amountCents?.[0]} />
        <Field label="Motivo" name="reason" autoComplete="off" maxLength={200} placeholder="Ej. deuda anotada en la libreta" error={state.errors?.reason?.[0]} />
        {state.message && <p className={state.status === "success" ? "notice-success" : "notice-error"} role="status">{state.message}</p>}
        <ActionSubmitButton className="button-secondary w-full" pendingLabel="Guardando…">Registrar ajuste</ActionSubmitButton>
      </form>
    </details>
  );
}

export function CustomerActiveForm({ customerId, active, hasDebt }: { customerId: string; active: boolean; hasDebt: boolean }) {
  const [state, formAction] = useActionState(setCustomerActiveAction, initial);
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {active && hasDebt ? (
        <p className="text-sm text-muted">Este cliente todavía tiene deuda pendiente, por eso no se puede desactivar.</p>
      ) : (
        <ActionSubmitButton className="button-quiet w-full justify-center text-sm text-muted" pendingLabel="Guardando…">{active ? "Desactivar cliente" : "Volver a activar"}</ActionSubmitButton>
      )}
      {state.message && <p className={state.status === "success" ? "notice-success" : "notice-error"} role="status">{state.message}</p>}
    </form>
  );
}
