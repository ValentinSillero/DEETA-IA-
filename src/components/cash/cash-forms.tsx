"use client";

import { useActionState } from "react";

import { closeCashAction, openCashAction, type CashFormState } from "@/actions/cash";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import { formatMoney } from "@/lib/inventory";

const initialState: CashFormState = { status: "idle" };

export function OpenCashForm() {
  const [state, action] = useActionState(openCashAction, initialState);
  return <form action={action} className="panel"><h2 className="text-xl font-black">Abrir caja</h2><p className="mt-2 text-sm leading-6 text-muted">¿Cuánto dinero hay inicialmente?</p><label className="field-label mt-5">Dinero inicial<input name="openingAmountCents" inputMode="decimal" className="field-input" placeholder="$ 0" autoFocus /></label>{state.message && <p className={`mt-4 ${state.status === "success" ? "notice-success" : "notice-error"}`}>{state.message}</p>}<ActionSubmitButton className="button-primary mt-5 w-full" pendingLabel="Abriendo…">Abrir caja</ActionSubmitButton></form>;
}

export function CloseCashForm({ id, expectedCashCents }: { id: string; expectedCashCents: number }) {
  const [state, action] = useActionState(closeCashAction, initialState);
  return <form action={action} className="panel"><input type="hidden" name="cashSessionId" value={id} /><h2 className="text-xl font-black">Cerrar caja</h2><p className="mt-2 text-sm text-muted">Caja esperada: <strong className="text-ink">{formatMoney(expectedCashCents)}</strong></p><label className="field-label mt-5">¿Cuánto dinero contaste?<input name="declaredCashCents" inputMode="decimal" className="field-input" placeholder="$ 0" /></label>{state.message && <div className={`mt-4 ${state.status === "success" ? "notice-success" : "notice-error"}`}><p>{state.message}</p>{state.differenceCents !== undefined && state.differenceCents !== 0 && <p className="mt-1">Diferencia: {formatMoney(state.differenceCents)}</p>}</div>}<ActionSubmitButton className="button-primary mt-5 w-full" pendingLabel="Cerrando…">Cerrar caja</ActionSubmitButton></form>;
}
