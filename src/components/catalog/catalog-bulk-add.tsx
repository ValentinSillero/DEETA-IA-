"use client";

import { CircleCheck, Layers, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { importCatalogAction, type CatalogImportState } from "@/actions/catalog";
import type { CatalogCategory } from "@/data/catalog";

const number = (value: number) => value.toLocaleString("es-AR");

// Agregar muchos productos de una vez: todo el catálogo o categorías enteras.
// No es la acción principal de la pantalla y siempre pide confirmación.
export function CatalogBulkAdd({ categories, onDone }: { categories: CatalogCategory[]; onDone: () => void }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"all" | "categories" | null>(null);
  const [result, setResult] = useState<CatalogImportState | null>(null);
  const [pending, startTransition] = useTransition();
  const total = categories.reduce((sum, category) => sum + category.total, 0);
  const chosenTotal = categories.filter((category) => chosen.has(category.name)).reduce((sum, category) => sum + category.total, 0);
  const amount = confirming === "all" ? total : chosenTotal;

  useEffect(() => {
    if (!confirming) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() { setConfirming(null); setResult(null); }

  function toggle(name: string) {
    setChosen((current) => { const next = new Set(current); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  }

  function run() {
    startTransition(async () => {
      const response = await importCatalogAction(confirming === "all" ? null : [...chosen]);
      setResult(response);
      if (response.status === "success") { setChosen(new Set()); onDone(); }
    });
  }

  return <>
    <details className="mt-6 rounded-2xl border border-line bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5">
        <Layers className="size-5 shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block font-semibold">Agregar muchos de una vez</span><span className="block text-sm text-muted">Por categoría o todo el catálogo</span></span>
      </summary>
      <div className="border-t border-line px-4 pb-4 pt-3 sm:px-5">
        <p className="text-sm font-semibold">Elegí categorías</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {categories.map((category) => <li key={category.name}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
              <input type="checkbox" checked={chosen.has(category.name)} onChange={() => toggle(category.name)} className="size-5 shrink-0 accent-[var(--deeta-primary)]" />
              <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">{number(category.total)}</span>
            </label>
          </li>)}
        </ul>
        <div className="mt-3 grid gap-2 sm:flex">
          <button type="button" onClick={() => setConfirming("categories")} disabled={chosen.size === 0} className="button-primary">
            Agregar {chosen.size === 0 ? "categorías" : `${number(chosenTotal)} productos`}
          </button>
          <button type="button" onClick={() => setConfirming("all")} className="button-secondary">Agregar todo el catálogo ({number(total)})</button>
        </div>
      </div>
    </details>

    {confirming ? <div className="fixed inset-0 z-[70] grid place-items-end bg-ink/45 sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target && !pending) close(); }}>
      <div className="w-full max-w-md overscroll-contain rounded-t-2xl bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="bulk-title">
        {result?.status === "success" ? <div role="status">
          <CircleCheck className="size-8 text-success" aria-hidden="true" />
          <h2 id="bulk-title" className="mt-2 text-xl font-bold">{confirming === "all" ? "Catálogo agregado" : "Productos agregados"}</h2>
          <p className="mt-2 leading-7"><strong className="figure">{number(result.created)}</strong> {result.created === 1 ? "producto agregado" : "productos agregados"}<br /><span className="text-muted">{number(result.existing)} ya {result.existing === 1 ? "estaba" : "estaban"} en tu negocio</span></p>
          <p className="mt-2 text-sm leading-6 text-muted">Quedaron sin precio y sin stock: no se pueden vender hasta que les cargues el precio.</p>
          <div className="mt-5 grid gap-2">
            <Link href="/productos?estado=noprice" className="button-primary">Ver productos sin precio</Link>
            <button type="button" onClick={close} className="button-secondary">Seguir en el catálogo</button>
          </div>
        </div> : <>
          <div className="flex items-start justify-between gap-3">
            <h2 id="bulk-title" className="text-xl font-bold">{confirming === "all" ? "¿Agregar todo el catálogo?" : "¿Agregar estas categorías?"}</h2>
            <button type="button" onClick={close} disabled={pending} className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label="Cerrar"><X className="size-5" aria-hidden="true" /></button>
          </div>
          <p className="mt-2 leading-7">Se agregarán aproximadamente <strong>{number(amount)} productos</strong> a tu negocio.</p>
          <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-muted">
            <li>Los productos que ya tengas no se duplican.</li>
            <li>Quedan sin precio y con stock 0: no se pueden vender hasta que les cargues el precio.</li>
            <li>Después podés cambiar precios y stock, o desactivar los que no vendas.</li>
          </ul>
          {result?.status === "error" ? <p className="notice-error mt-4" role="alert">{result.message}</p> : null}
          {pending ? <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-muted" role="status"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Agregando productos… puede tardar unos segundos.</p> : null}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={close} disabled={pending} className="button-secondary">Cancelar</button>
            <button type="button" onClick={run} disabled={pending} className="button-primary">{pending ? "Agregando…" : "Agregar productos"}</button>
          </div>
        </>}
      </div>
    </div> : null}
  </>;
}
