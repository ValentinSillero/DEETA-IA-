"use client";

import { useActionState } from "react";

import {
  createExpenseCategoryAction,
  toggleExpenseCategoryAction,
  updateExpenseCategoryAction,
  type ExpenseMutationState,
} from "@/actions/expenses";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import type { ExpenseCategoryDto } from "@/data/expenses";

export function CategoryManager({ categories, canManage }: { categories: ExpenseCategoryDto[]; canManage: boolean }) {
  const [state, action] = useActionState(createExpenseCategoryAction, { status: "idle" } satisfies ExpenseMutationState);

  return <div>
    <section className="panel">
      <h2 className="section-title">Nueva categoría</h2>
      {canManage ? <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="new-category-name">Nombre de la categoría</label><input id="new-category-name" name="name" className="field-input min-w-0 flex-1" placeholder="Ej. Proveedores" required /><ActionSubmitButton className="button-primary shrink-0">Crear categoría</ActionSubmitButton></form> : <p className="mt-3 text-sm text-muted">Solo administradores pueden cambiar categorías.</p>}
      {state.message && <p className={`mt-3 ${state.status === "success" ? "notice-success" : "notice-error"}`} role="status">{state.message}</p>}
    </section>
    <section className="list-surface mt-5">{categories.map((category) => <CategoryRow key={category.id} category={category} canManage={canManage} />)}</section>
  </div>;
}

function CategoryRow({ category, canManage }: { category: ExpenseCategoryDto; canManage: boolean }) {
  const [state, action] = useActionState(updateExpenseCategoryAction, { status: "idle" } satisfies ExpenseMutationState);

  return <article className={`border-b border-line p-4 last:border-b-0 ${category.isActive ? "bg-surface" : "bg-surface-2 opacity-70"}`}>
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input type="hidden" name="categoryId" value={category.id} />
      <input name="name" defaultValue={category.name} disabled={!canManage} className="field-input min-w-0 flex-1" aria-label={`Nombre de ${category.name}`} />
      <span className="shrink-0 text-xs font-bold text-muted">{category.usedCount} gastos</span>
      {canManage && <ActionSubmitButton className="button-secondary shrink-0" pendingLabel="Guardando…">Guardar</ActionSubmitButton>}
    </form>
    {state.message && <p className={`mt-3 text-sm font-bold ${state.status === "success" ? "text-success" : "text-red-700"}`} role="status">{state.message}</p>}
    {canManage && <form action={toggleExpenseCategoryAction} className="mt-3"><input type="hidden" name="categoryId" value={category.id} /><input type="hidden" name="isActive" value={String(!category.isActive)} /><button className="min-h-11 text-sm font-bold text-muted underline underline-offset-4" type="submit">{category.isActive ? "Desactivar" : "Volver a activar"}</button></form>}
  </article>;
}
