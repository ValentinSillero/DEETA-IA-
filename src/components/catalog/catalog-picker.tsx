"use client";

import { AlertTriangle, ArrowLeft, Check, CircleCheck, Loader2, PackagePlus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { addCatalogProductsAction, type CatalogAddState } from "@/actions/catalog";
import type { CatalogCategory, CatalogItem, CatalogSearchResult } from "@/data/catalog";
import { CATALOG_MAX_SELECTION, catalogProductName, effectiveCatalogQuery } from "@/lib/catalog";
import { keepFocusOnPress, releaseFocus } from "@/lib/keep-focus";

type SearchResult = CatalogSearchResult;

type Values = { salePriceCents: string; costPriceCents: string; initialStock: string; minimumStock: string };
const emptyValues: Values = { salePriceCents: "", costPriceCents: "", initialStock: "", minimumStock: "" };

function ReviewSize() {
  return <span className="status text-[#a8530f]"><AlertTriangle className="size-3.5" aria-hidden="true" />Revisá el tamaño</span>;
}

function ProductLine({ item }: { item: CatalogItem }) {
  return <span className="min-w-0 flex-1">
    <span className="block break-words font-semibold leading-snug text-ink">{item.name}</span>
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
      {item.size ? <span>{item.size}</span> : null}
      {item.brand ? <span>{item.size ? "· " : ""}{item.brand}</span> : null}
      {item.needsReview ? <ReviewSize /> : null}
    </span>
  </span>;
}

// La primera página llega renderizada desde el servidor; las búsquedas siguientes
// piden de a 30 resultados. Las categorías vienen una sola vez (globales, en caché).
export function CatalogPicker({ initial, categories }: { initial: CatalogSearchResult; categories: CatalogCategory[] }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [kioskOnly, setKioskOnly] = useState(initial.kioskOnly);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult | null>(initial);
  // Se incrementa para volver a buscar (por ejemplo, después de agregar).
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Map<string, CatalogItem>>(new Map());
  const [step, setStep] = useState<"pick" | "confirm" | "done">("pick");
  const [values, setValues] = useState<Record<string, Values>>({});
  const [state, setState] = useState<CatalogAddState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Espera breve mientras se escribe; con una sola letra no se busca texto.
    const timer = setTimeout(() => setDebouncedQuery(effectiveCatalogQuery(query)), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Búsqueda en el servidor; "Ver más" suma la página siguiente a la lista.
  // "Cargando" se deriva de qué búsqueda terminó, sin setState dentro del efecto.
  const requestKey = JSON.stringify([debouncedQuery, category, kioskOnly, page, reload]);
  const [settled, setSettled] = useState<{ key: string; error: string | null } | null>({ key: requestKey, error: null });
  const skipInitialFetch = useRef(true);
  const loading = settled?.key !== requestKey;
  const error = loading ? null : settled.error;
  useEffect(() => {
    // La primera página ya vino del servidor.
    if (skipInitialFetch.current) { skipInitialFetch.current = false; return; }
    // Si llega otra búsqueda, la anterior se cancela (sin respuestas fuera de orden).
    const controller = new AbortController();
    const params = new URLSearchParams({ q: debouncedQuery, pagina: String(page), kiosco: kioskOnly ? "1" : "0" });
    if (category) params.set("categoria", category);
    fetch(`/api/catalog?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "No pudimos buscar en el catálogo. Intentá nuevamente.");
        return payload as SearchResult;
      })
      .then((payload) => {
        setResult((current) => page > 1 && current ? { ...payload, items: [...current.items, ...payload.items] } : payload);
        setSettled({ key: requestKey, error: null });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setSettled({ key: requestKey, error: cause instanceof Error ? cause.message : "No pudimos buscar en el catálogo." });
      });
    return () => controller.abort();
  }, [requestKey, debouncedQuery, category, kioskOnly, page]);

  function changeFilter(update: () => void) { update(); setPage(1); }

  function toggle(item: CatalogItem) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.barcode)) next.delete(item.barcode);
      else if (next.size < CATALOG_MAX_SELECTION) next.set(item.barcode, item);
      return next;
    });
  }

  function remove(barcode: string) {
    setSelected((current) => { const next = new Map(current); next.delete(barcode); if (next.size === 0) setStep("pick"); return next; });
  }

  function setValue(barcode: string, field: keyof Values, value: string) {
    setValues((current) => ({ ...current, [barcode]: { ...(current[barcode] ?? emptyValues), [field]: value } }));
  }

  function goTo(nextStep: typeof step) {
    setStep(nextStep);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  }

  function confirm() {
    const items = [...selected.keys()].map((barcode) => ({ barcode, ...(values[barcode] ?? emptyValues) }));
    startTransition(async () => {
      const response = await addCatalogProductsAction(items);
      setState(response);
      if (response.status === "success") { setSelected(new Map()); setValues({}); goTo("done"); }
    });
  }

  if (step === "done") {
    return <div ref={topRef} className="panel mt-6 scroll-mt-20 text-center" role="status">
      <CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />
      <h2 className="mt-3 text-xl font-bold">{state.message}</h2>
      <p className="mt-1 text-sm text-muted">Ya podés venderlos y controlar su stock.</p>
      <div className="mt-5 grid gap-2 sm:flex sm:justify-center">
        <Link href="/productos" className="button-primary">Ver mis productos</Link>
        <button type="button" onClick={() => { setState({ status: "idle" }); setPage(1); setReload((value) => value + 1); goTo("pick"); }} className="button-secondary">Agregar más</button>
      </div>
    </div>;
  }

  if (step === "confirm") {
    const items = [...selected.values()];
    return <div ref={topRef} className="mt-6 scroll-mt-20">
      <button type="button" onClick={() => goTo("pick")} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a la lista</button>
      <h2 className="section-title mt-2">Poné los precios</h2>
      <p className="mt-1 text-sm leading-6 text-muted">El precio de venta es obligatorio. Lo demás podés completarlo después. Si no ponés el precio de compra, el margen de ese producto se va a ver más alto hasta que lo cargues.</p>
      <ul className="mt-4 grid gap-3">
        {items.map((item) => {
          const value = values[item.barcode] ?? emptyValues;
          const fieldErrors = state.errors?.[item.barcode] ?? {};
          const id = (field: string) => `${field}-${item.barcode}`;
          return <li key={item.barcode} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold leading-snug">{catalogProductName(item.name, item.size)}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-muted"><span className="font-mono text-xs leading-5">{item.barcode}</span>{item.needsReview ? <ReviewSize /> : null}</p>
              </div>
              <button type="button" onClick={() => remove(item.barcode)} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-700" aria-label={`Quitar ${item.name}`}><Trash2 className="size-5" aria-hidden="true" /></button>
            </div>
            <div className="mt-3 grid gap-3">
              <label className="field-label" htmlFor={id("sale")}>Precio de venta *
                <input id={id("sale")} inputMode="decimal" autoComplete="off" placeholder="Ej. 1500" value={value.salePriceCents} onChange={(event) => setValue(item.barcode, "salePriceCents", event.target.value)} aria-invalid={fieldErrors.salePriceCents ? true : undefined} className="field-input" />
              </label>
              {fieldErrors.salePriceCents ? <p className="field-error">{fieldErrors.salePriceCents}</p> : null}
              <div className="grid grid-cols-3 gap-2">
                <label className="field-label text-xs" htmlFor={id("cost")}>Compra
                  <input id={id("cost")} inputMode="decimal" autoComplete="off" placeholder="Opcional" value={value.costPriceCents} onChange={(event) => setValue(item.barcode, "costPriceCents", event.target.value)} aria-invalid={fieldErrors.costPriceCents ? true : undefined} className="field-input px-2.5" />
                </label>
                <label className="field-label text-xs" htmlFor={id("stock")}>Stock
                  <input id={id("stock")} inputMode="numeric" autoComplete="off" placeholder="0" value={value.initialStock} onChange={(event) => setValue(item.barcode, "initialStock", event.target.value)} aria-invalid={fieldErrors.initialStock ? true : undefined} className="field-input px-2.5" />
                </label>
                <label className="field-label text-xs" htmlFor={id("min")}>Mínimo
                  <input id={id("min")} inputMode="numeric" autoComplete="off" placeholder="0" value={value.minimumStock} onChange={(event) => setValue(item.barcode, "minimumStock", event.target.value)} aria-invalid={fieldErrors.minimumStock ? true : undefined} className="field-input px-2.5" />
                </label>
              </div>
              {[fieldErrors.costPriceCents, fieldErrors.initialStock, fieldErrors.minimumStock].filter(Boolean).map((message) => <p key={message} className="field-error">{message}</p>)}
            </div>
          </li>;
        })}
      </ul>
      {state.status === "error" && state.message ? <p className="notice-error mt-4" role="alert">{state.message}</p> : null}
      <button type="button" onClick={confirm} disabled={pending} className="button-brand mt-5 w-full">
        {pending ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" />Agregando…</> : <><PackagePlus className="size-5" aria-hidden="true" />Agregar {items.length === 1 ? "1 producto" : `${items.length} productos`}</>}
      </button>
    </div>;
  }

  const items = result?.items ?? [];
  return <div ref={topRef} className="scroll-mt-20">
    <div className="mt-6 grid gap-3">
      <label className="relative block">
        <span className="sr-only">Buscar en el catálogo</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nombre, marca o código…" className="field-input pl-11" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" role="switch" checked={kioskOnly} onChange={(event) => changeFilter(() => { setKioskOnly(event.target.checked); setCategory(null); })} className="size-5 accent-[var(--deeta-primary)]" />
          Solo kiosco
        </label>
        {result ? <p className="text-sm text-muted" aria-live="polite">{result.total === 1 ? "1 producto" : `${result.total.toLocaleString("es-AR")} productos`}</p> : null}
      </div>
      <nav className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Categorías">
        <button type="button" className="chip" data-active={category === null || undefined} aria-pressed={category === null} onClick={() => changeFilter(() => setCategory(null))}>Todas</button>
        {categories.filter((item) => !kioskOnly || item.kioskTotal > 0).map((item) => <button key={item.name} type="button" className="chip" data-active={category === item.name || undefined} aria-pressed={category === item.name} onClick={() => changeFilter(() => setCategory(category === item.name ? null : item.name))}>{item.name}</button>)}
      </nav>
    </div>

    {error ? <p className="notice-error mt-4" role="alert">{error}</p> : null}
    {!error && !loading && items.length === 0 ? <div className="panel mt-4 text-center"><p className="font-semibold">No encontramos productos</p><p className="mt-1 text-sm text-muted">Probá con otra palabra, la marca o el código de barras.</p></div> : null}

    {items.length > 0 ? <ul className="list-surface mt-4" aria-label="Productos del catálogo" aria-busy={loading}>
      {items.map((item) => {
        const checked = selected.has(item.barcode);
        return <li key={item.barcode} className="border-b border-line last:border-b-0">
          {item.owned
            ? <div className="flex min-h-16 items-center gap-3 px-4 py-3 opacity-70 sm:px-5"><span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2"><Check className="size-4 text-success" aria-hidden="true" /></span><ProductLine item={item} /><span className="status shrink-0 text-success">Ya lo tenés</span></div>
            : <label className={`flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors sm:px-5 ${checked ? "bg-brand-soft" : "hover:bg-surface-2"}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(item)} disabled={!checked && selected.size >= CATALOG_MAX_SELECTION} className="size-6 shrink-0 accent-[var(--deeta-primary)]" />
              <ProductLine item={item} />
            </label>}
        </li>;
      })}
    </ul> : null}

    {loading ? <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted" role="status"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Buscando…</p> : null}
    {!loading && result && result.page < result.pageCount ? <button type="button" onClick={() => setPage((current) => current + 1)} className="button-secondary mt-4 w-full">Ver más productos</button> : null}

    {selected.size > 0 ? <div className="fixed bottom-[calc(var(--mobile-nav-offset)+12px+env(safe-area-inset-bottom))] left-3 right-3 z-30 flex items-center gap-2 rounded-xl border border-white/15 bg-ink p-2 pl-4 text-white shadow-lg md:bottom-5 md:left-[260px] md:right-5 lg:left-auto lg:w-[28rem]">
      <p className="min-w-0 flex-1 text-sm font-semibold">{selected.size === 1 ? "1 elegido" : `${selected.size} elegidos`}</p>
      <button type="button" onMouseDown={keepFocusOnPress} onClick={() => setSelected(new Map())} className="grid size-11 shrink-0 place-items-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white" aria-label="Quitar la selección"><X className="size-5" aria-hidden="true" /></button>
      <button type="button" onMouseDown={keepFocusOnPress} onClick={() => { releaseFocus(); setState({ status: "idle" }); goTo("confirm"); }} className="button-brand min-h-11 shrink-0 px-4">Agregar seleccionados</button>
    </div> : null}
    {selected.size > 0 ? <div className="h-20" aria-hidden="true" /> : null}
  </div>;
}
