"use client";

import { ListChecks, Loader2, PackagePlus } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { addCatalogProductsAction } from "@/actions/catalog";
import type { CatalogSuggestion } from "@/data/catalog";

// Escáner: el código no está en el negocio pero sí en el catálogo sugerido.
// El alta se hace acá mismo (sin salir de la pantalla, así no se pierde el
// carrito): nombre y código vienen completos y solo se pide el precio.
// `askStock` muestra el stock a la vista (en Vender hace falta para cobrarlo).
export function CatalogSuggestionNotice({ suggestion, askStock = false, onAdded }: { suggestion: CatalogSuggestion; askStock?: boolean; onAdded: (barcode: string) => void }) {
  const id = useId();
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [minimum, setMinimum] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addCatalogProductsAction([{ barcode: suggestion.barcode, salePriceCents: salePrice, costPriceCents: costPrice, initialStock: stock, minimumStock: minimum }]);
      if (result.status === "success") { setError(null); onAdded(suggestion.barcode); return; }
      const fields = result.errors?.[suggestion.barcode];
      setError((fields && Object.values(fields)[0]) ?? result.message ?? "No pudimos agregar el producto. Intentá nuevamente.");
    });
  }

  const stockField = <label className="field-label text-xs" htmlFor={`${id}-stock`}>{askStock ? "¿Cuántas tenés?" : "Stock"}
    <input id={`${id}-stock`} inputMode="numeric" autoComplete="off" placeholder="0" value={stock} onChange={(event) => setStock(event.target.value)} className="field-input px-2.5" />
  </label>;

  return <div className="rounded-xl border border-mint-200 bg-brand-soft p-3.5 text-left" role="status">
    <p className="flex items-center gap-1.5 text-xs font-semibold text-brand"><ListChecks className="size-4" aria-hidden="true" />Está en el catálogo</p>
    <p className="mt-1 text-sm text-ink">Encontramos este producto: <strong className="font-semibold">{suggestion.name}</strong>.{suggestion.canAdd ? " ¿Lo agregás?" : ""}</p>
    {suggestion.needsReview ? <p className="mt-0.5 text-xs text-[#a8530f]">Revisá el tamaño antes de venderlo.</p> : null}
    {!suggestion.canAdd ? <p className="mt-1 text-sm text-muted">Pedile a quien administra el negocio que lo agregue.</p> : (
      <form onSubmit={submit} className="mt-3 grid gap-2.5">
        <div className={askStock ? "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2" : ""}>
          <label className="field-label text-xs" htmlFor={`${id}-sale`}>Precio de venta *
            <input id={`${id}-sale`} inputMode="decimal" autoComplete="off" placeholder="Ej. 1500" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} className="field-input" autoFocus required />
          </label>
          {askStock ? stockField : null}
        </div>
        <details className="text-sm">
          <summary className="flex min-h-10 cursor-pointer items-center font-semibold text-muted">Más datos (opcional)</summary>
          <div className={`mt-1 grid gap-2 ${askStock ? "grid-cols-2" : "grid-cols-3"}`}>
            <label className="field-label text-xs" htmlFor={`${id}-cost`}>Compra
              <input id={`${id}-cost`} inputMode="decimal" autoComplete="off" placeholder="Opcional" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} className="field-input px-2.5" />
            </label>
            {askStock ? null : stockField}
            <label className="field-label text-xs" htmlFor={`${id}-min`}>Mínimo
              <input id={`${id}-min`} inputMode="numeric" autoComplete="off" placeholder="0" value={minimum} onChange={(event) => setMinimum(event.target.value)} className="field-input px-2.5" />
            </label>
          </div>
        </details>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <button type="submit" disabled={pending} className="button-primary min-h-11 w-full">
          {pending ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" />Agregando…</> : <><PackagePlus className="size-5" aria-hidden="true" />Agregar producto</>}
        </button>
      </form>
    )}
  </div>;
}
