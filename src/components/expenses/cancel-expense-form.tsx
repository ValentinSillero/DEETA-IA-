"use client";

import { useActionState } from "react";

import { cancelExpenseAction, type ExpenseMutationState } from "@/actions/expenses";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";

export function CancelExpenseForm({ expenseId }: { expenseId: string }) {
  const [state, action] = useActionState(cancelExpenseAction, { status: "idle" } satisfies ExpenseMutationState);
  return <form action={action} onSubmit={(event) => { if (!window.confirm("¿Seguro que querés cancelar este gasto?")) event.preventDefault(); }} className="panel mt-5"><input type="hidden" name="expenseId" value={expenseId} /><label className="field-label">Motivo (opcional)<textarea name="reason" className="field-input min-h-24" maxLength={300} placeholder="Ej. Se cargó dos veces" /></label>{state.message && <p className={`mt-4 ${state.status === "success" ? "notice-success" : "notice-error"}`}>{state.message}</p>}{state.status !== "success" && <ActionSubmitButton className="button-danger mt-5" pendingLabel="Cancelando…">Cancelar gasto</ActionSubmitButton>}</form>;
}
