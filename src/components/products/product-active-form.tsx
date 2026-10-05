"use client";

import { useActionState } from "react";

import { setProductActiveAction, type ProductFormState } from "@/actions/products";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";

export function ProductActiveForm({ productId, isActive }: { productId: string; isActive: boolean }) {
  const [state, action] = useActionState(
    setProductActiveAction,
    { status: "idle" } satisfies ProductFormState,
  );

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          isActive &&
          !window.confirm(
            "Este producto dejará de aparecer entre tus productos activos, pero conservaremos su historial.",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="space-y-3"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <ActionSubmitButton
        pendingLabel={isActive ? "Desactivando…" : "Reactivando…"}
        className={isActive ? "button-secondary w-full text-red-700" : "button-primary w-full"}
      >
        {isActive ? "Desactivar producto" : "Reactivar producto"}
      </ActionSubmitButton>
      {state.message && (
        <div className={state.status === "success" ? "notice-success" : "notice-error"} role="status">
          {state.message}
        </div>
      )}
    </form>
  );
}
