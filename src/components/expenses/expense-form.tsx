"use client";

import { Banknote, CheckCircle2, CreditCard, Landmark, WalletCards } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { createExpenseAction, type ExpenseFormState } from "@/actions/expenses";
import { Field, SelectField } from "@/components/forms/field";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import type { ExpenseCategoryDto } from "@/data/expenses";

const methods = [
  { value: "CASH", label: "Efectivo", icon: Banknote },
  { value: "TRANSFER", label: "Transferencia", icon: Landmark },
  { value: "CARD", label: "Tarjeta", icon: CreditCard },
  { value: "OTHER", label: "Otro", icon: WalletCards },
] as const;

export function ExpenseForm({ categories, today, hasOpenCash }: { categories: ExpenseCategoryDto[]; today: string; hasOpenCash: boolean }) {
  const [state, action] = useActionState(createExpenseAction, { status: "idle" } satisfies ExpenseFormState);
  const [method, setMethod] = useState<(typeof methods)[number]["value"]>("CASH");
  if (state.status === "success") return <section className="panel text-center"><CheckCircle2 className="mx-auto size-12 text-success" /><h2 className="mt-4 text-2xl font-black">Gasto anotado</h2><p className={`mt-3 ${state.unlinkedCash ? "notice-error" : "notice-success"}`}>{state.message}</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><Link href="/gastos/nuevo" className="button-primary">Anotar otro gasto</Link><Link href={state.expenseId ? `/gastos/${state.expenseId}` : "/gastos"} className="button-secondary">Ver gasto</Link></div></section>;

  return <form action={action} className="panel space-y-5" noValidate>
    <Field label="¿En qué gastaste?" name="description" placeholder="Ej. Mercadería de limpieza" error={state.errors?.description?.[0]} required autoFocus />
    <Field label="¿Cuánto pagaste?" name="amountCents" inputMode="decimal" placeholder="$ 0" error={state.errors?.amountCents?.[0]} required />
    <SelectField label="Categoría" name="categoryId" defaultValue="" error={state.errors?.categoryId?.[0]} required>
      <option value="" disabled>Elegí una categoría</option>
      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    </SelectField>
    <fieldset><legend className="field-label">¿Cómo pagaste?</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{methods.map(({ value, label, icon: Icon }) => <label key={value} className={`grid min-h-20 cursor-pointer place-items-center rounded-2xl border px-2 py-3 text-center text-xs font-black ${method === value ? "border-ink bg-mint-100" : "border-line bg-white"}`}><input className="sr-only" type="radio" name="paymentMethod" value={value} checked={method === value} onChange={() => setMethod(value)} /><Icon className="size-5" />{label}</label>)}</div></fieldset>
    {method === "CASH" && !hasOpenCash && <p className="notice-error">No hay una caja abierta. El gasto quedará registrado, pero no se asociará a una caja.</p>}
    <Field label="Fecha" name="expenseDate" type="date" defaultValue={today} max={today} error={state.errors?.expenseDate?.[0]} required />
    {state.message && <p className="notice-error" role="status">{state.message}</p>}
    <ActionSubmitButton pendingLabel="Guardando gasto…">GUARDAR GASTO</ActionSubmitButton>
  </form>;
}
