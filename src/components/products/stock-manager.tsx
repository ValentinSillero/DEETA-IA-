"use client";

import { Minus, PackagePlus, RefreshCw } from "lucide-react";
import { useState, useActionState } from "react";

import { stockMovementAction, type ProductFormState } from "@/actions/products";
import { Field } from "@/components/forms/field";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import type { EditableStockMovement } from "@/lib/inventory";

const modes = [
  { type: "IN", label: "Ingresar", icon: PackagePlus },
  { type: "OUT", label: "Quitar", icon: Minus },
  { type: "ADJUSTMENT", label: "Ajustar", icon: RefreshCw },
] as const;

export function StockManager({
  productId,
  currentStock,
  minimumStock,
}: {
  productId: string;
  currentStock: number;
  minimumStock: number;
}) {
  const [mode, setMode] = useState<EditableStockMovement>("IN");

  return (
    <section className="panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-muted">Cantidad disponible</p>
          <p className="mt-1 text-4xl font-black tracking-tight">{currentStock}</p>
          <p className="mt-1 text-xs font-bold text-muted">Mínimo recomendado: {minimumStock}</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-1 rounded-xl border border-line bg-[#f3f2f8] p-1" role="tablist" aria-label="Acciones de stock">
        {modes.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={mode === type}
            onClick={() => setMode(type)}
            className={`flex min-h-12 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-extrabold transition-colors sm:text-sm ${mode === type ? "bg-surface text-ink" : "text-muted"}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <MovementForm key={mode} mode={mode} productId={productId} currentStock={currentStock} />
    </section>
  );
}

function MovementForm({
  mode,
  productId,
  currentStock,
}: {
  mode: EditableStockMovement;
  productId: string;
  currentStock: number;
}) {
  const [state, action] = useActionState(
    stockMovementAction,
    { status: "idle" } satisfies ProductFormState,
  );
  const [amount, setAmount] = useState("");
  const isAdjustment = mode === "ADJUSTMENT";
  const title = mode === "IN" ? "Ingresar mercadería" : mode === "OUT" ? "Quitar mercadería" : "Ajustar cantidad";
  const countedStock = /^\d+$/.test(amount) ? Number(amount) : null;

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="type" value={mode} />
      <div>
        <h2 className="text-lg font-black">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {isAdjustment
            ? `DEETA tiene ${currentStock}. Ingresá la cantidad que contaste.`
            : mode === "IN"
              ? "¿Cuántas unidades entraron?"
              : "¿Cuántas unidades querés quitar?"}
        </p>
      </div>
      <Field
        label={isAdjustment ? "Cantidad real" : "Cantidad"}
        name="amount"
        type="number"
        inputMode="numeric"
        min={isAdjustment ? "0" : "1"}
        step="1"
        placeholder="0"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={state.errors?.amount?.[0]}
        required
      />
      {isAdjustment && countedStock !== null && (
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
          <div className="bg-surface p-3"><p className="text-[11px] font-bold text-muted">Registrado</p><p className="mt-1 font-black">{currentStock}</p></div>
          <div className="bg-surface p-3"><p className="text-[11px] font-bold text-muted">Contado</p><p className="mt-1 font-black">{countedStock}</p></div>
          <div className="bg-surface p-3"><p className="text-[11px] font-bold text-muted">Diferencia</p><p className={`mt-1 font-black ${countedStock - currentStock < 0 ? "text-red-700" : "text-success"}`}>{countedStock - currentStock > 0 ? "+" : ""}{countedStock - currentStock}</p></div>
        </div>
      )}
      <Field
        label="Motivo (opcional)"
        name="reason"
        placeholder={mode === "IN" ? "Ej. Compra a proveedor" : mode === "OUT" ? "Ej. Rotura" : "Ej. Conteo del local"}
        error={state.errors?.reason?.[0]}
      />
      {state.message && (
        <div className={state.status === "success" ? "notice-success" : "notice-error"} role="status">
          <p>{state.message}</p>
          {state.stockResult && (
            <p className="mt-1 font-extrabold">
              {state.stockResult.previousStock} → {state.stockResult.resultingStock}
            </p>
          )}
        </div>
      )}
      <ActionSubmitButton pendingLabel="Actualizando…">
        {isAdjustment ? "Confirmar ajuste" : mode === "IN" ? "Confirmar ingreso" : "Confirmar salida"}
      </ActionSubmitButton>
    </form>
  );
}
