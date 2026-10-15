"use client";

import { Camera } from "lucide-react";
import { useActionState, useState } from "react";

import type { ProductFormState } from "@/actions/products";
import { Field, TextAreaField } from "@/components/forms/field";
import { BarcodeScanner } from "@/components/scanner/barcode-scanner";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import type { ScannedBarcode } from "@/lib/barcode";

type ProductValues = {
  id: string;
  name: string;
  description: string | null;
  costPriceCents: number;
  salePriceCents: number;
  minimumStock: number;
  barcode: string | null;
};

function moneyInputValue(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function ProductForm({
  action,
  product,
  initialBarcode,
}: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  product?: ProductValues;
  initialBarcode?: string;
}) {
  const [state, formAction] = useActionState(
    action,
    { status: "idle" } satisfies ProductFormState,
  );
  const editing = Boolean(product);
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode ?? "");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string>();

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {product && <input type="hidden" name="productId" value={product.id} />}
      <Field
        label="Nombre *"
        name="name"
        placeholder="Ej. Coca-Cola 2.25L"
        defaultValue={product?.name}
        error={state.errors?.name?.[0]}
        autoFocus
        required
      />
      <TextAreaField
        label="Descripción (opcional)"
        name="description"
        placeholder="Una aclaración que te ayude a reconocerlo"
        defaultValue={product?.description ?? ""}
        error={state.errors?.description?.[0]}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Precio de compra *"
          name="costPriceCents"
          inputMode="decimal"
          placeholder="Ej. 1000"
          defaultValue={product ? moneyInputValue(product.costPriceCents) : undefined}
          error={state.errors?.costPriceCents?.[0]}
          required
        />
        <Field
          label="Precio de venta *"
          name="salePriceCents"
          inputMode="decimal"
          placeholder="Ej. 1500"
          defaultValue={product ? moneyInputValue(product.salePriceCents) : undefined}
          error={state.errors?.salePriceCents?.[0]}
          required
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {!editing && (
          <Field
            label="Stock inicial"
            name="initialStock"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            defaultValue="0"
            error={state.errors?.initialStock?.[0]}
          />
        )}
        <Field
          label="Stock mínimo"
          name="minimumStock"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          defaultValue={product?.minimumStock ?? 0}
          error={state.errors?.minimumStock?.[0]}
        />
      </div>
      <div><Field label="Código de barras (opcional)" name="barcode" inputMode="text" placeholder="Podés escribirlo manualmente" value={barcode} onChange={(event) => setBarcode(event.target.value)} error={state.errors?.barcode?.[0]} /><button type="button" onClick={() => setScannerOpen(true)} className="button-secondary mt-3 w-full"><Camera className="size-5" /> Escanear código</button></div>
      {editing && (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm leading-6 text-muted">
          Para cambiar la cantidad disponible usá las acciones de stock en la pantalla del producto.
        </p>
      )}
      {state.message && (
        <div className={state.status === "success" ? "notice-success" : "notice-error"} role="status">
          {state.message}
        </div>
      )}
      <ActionSubmitButton>{editing ? "Guardar cambios" : "Crear producto"}</ActionSubmitButton>
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={(scan: ScannedBarcode) => { setScannerOpen(false); setPendingBarcode(scan.value); }} />
      {pendingBarcode && <div className="fixed inset-0 z-[80] grid place-items-end bg-ink/55 sm:place-items-center sm:p-5"><section className="w-full max-w-md rounded-t-[30px] bg-white p-6 sm:rounded-2xl"><p className="text-sm font-bold text-mint-600">Código leído</p><h2 className="mt-2 text-xl font-black">¿Querés asociarlo a {product?.name ?? "este producto"}?</h2><p className="mt-4 rounded-2xl bg-surface-2 p-4 font-mono font-bold">{pendingBarcode}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setPendingBarcode(undefined)} className="button-secondary">Cancelar</button><button type="button" onClick={() => { setBarcode(pendingBarcode); setPendingBarcode(undefined); }} className="button-primary">Asociar</button></div></section></div>}
    </form>
  );
}
