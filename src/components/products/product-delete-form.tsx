"use client";

import { useActionState, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";

import { deleteProductAction, type ProductFormState } from "@/actions/products";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";

export function ProductDeleteForm({ productId, productName }: { productId: string; productName: string }) {
  const [state, action, pending] = useActionState(
    deleteProductAction,
    { status: "idle" } satisfies ProductFormState,
  );
  // El diálogo queda abierto para la respuesta vigente al abrirlo: si el servidor
  // lo rechaza llega otra respuesta, se cierra y el motivo queda a la vista.
  const [openedFor, setOpenedFor] = useState<ProductFormState | null>(null);
  const open = openedFor === state;
  const setOpen = (value: boolean) => setOpenedFor(value ? state : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpenedFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen(true)} className="button-danger w-full">
        <Trash2 className="size-4" aria-hidden="true" /> Eliminar producto
      </button>
      {state.status === "error" && state.message && (
        <div className="notice-error" role="alert">{state.message}</div>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-end bg-ink/45 sm:place-items-center sm:p-5"
          onMouseDown={(event) => { if (event.currentTarget === event.target && !pending) setOpen(false); }}
        >
          <div className="w-full max-w-md overscroll-contain rounded-t-2xl bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="delete-product-title" aria-describedby="delete-product-text">
            <div className="flex items-start justify-between gap-3">
              <h2 id="delete-product-title" className="text-xl font-bold">Eliminar producto</h2>
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Cerrar"><X className="size-5" aria-hidden="true" /></button>
            </div>
            <p id="delete-product-text" className="mt-2 break-words leading-7">
              Esta acción eliminará definitivamente <strong>{productName}</strong>. No se puede deshacer.
            </p>
            <form action={action} className="mt-5 grid grid-cols-2 gap-2">
              <input type="hidden" name="productId" value={productId} />
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="button-secondary" autoFocus>Cancelar</button>
              <ActionSubmitButton pendingLabel="Eliminando…" className="button-danger">Eliminar producto</ActionSubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
