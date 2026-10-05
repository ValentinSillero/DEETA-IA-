"use client";

import { useActionState } from "react";

import { cancelSaleAction, type CancelSaleState } from "@/actions/sales";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";

const initialState: CancelSaleState = { status: "idle" };

export function CancelSaleForm({ saleId }: { saleId: string }) {
  const [state, action] = useActionState(cancelSaleAction, initialState);
  return <form action={action} onSubmit={(event) => { if (!window.confirm("¿Seguro que querés cancelar esta venta?")) event.preventDefault(); }} className="panel mt-6">
    <input type="hidden" name="saleId" value={saleId} />
    <label className="field-label">Motivo (opcional)<input name="reason" className="field-input" maxLength={300} placeholder="Ej.: cobro duplicado" /></label>
    {state.message && <p className={`mt-4 ${state.status === "success" ? "notice-success" : "notice-error"}`}>{state.message}</p>}
    {state.status !== "success" && <ActionSubmitButton className="button-danger mt-4" pendingLabel="Cancelando…">Cancelar venta</ActionSubmitButton>}
  </form>;
}
