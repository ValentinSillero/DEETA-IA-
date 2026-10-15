"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, LoaderCircle, Pencil, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { PRODUCT_IMPORT_FIELD_LABELS, PRODUCT_IMPORT_FIELDS, type ExistingProductStrategy, type ProductImportField, type ProductImportMapping } from "@/lib/product-import-contract";
import { formatMoney } from "@/lib/inventory";

type PreviewRow = {
  id: string;
  rowNumber: number;
  rawValues: string[];
  status: "PENDING" | "READY" | "WARNING" | "ERROR" | "IMPORTED" | "UPDATED" | "SKIPPED";
  issues: string[];
  included: boolean;
  name: string | null;
  barcode: string | null;
  costPriceCents: number | null;
  salePriceCents: number | null;
  initialStock: number | null;
  minimumStock: number | null;
  existingProductId: string | null;
  editable: Record<Exclude<ProductImportField, "IGNORE">, string>;
};

export type ProductImportView = {
  id: string;
  originalFilename: string;
  status: "UPLOADED" | "READY" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "FAILED";
  headers: string[];
  mapping: ProductImportMapping;
  existingStrategy: ExistingProductStrategy;
  totalRows: number;
  readyRows: number;
  warningRows: number;
  errorRows: number;
  importedRows: number;
  updatedRows: number;
  skippedRows: number;
  rows: PreviewRow[];
};

const strategies: { value: ExistingProductStrategy; title: string; description: string }[] = [
  { value: "SKIP", title: "No modificar", description: "Es la opción más segura. Los productos existentes se omiten." },
  { value: "UPDATE_PRICES", title: "Actualizar precios", description: "Actualiza compra, venta y stock mínimo. No cambia la cantidad disponible." },
  { value: "UPDATE_PRICES_STOCK", title: "Actualizar precios y stock", description: "También ajusta la cantidad y registra el movimiento en el historial." },
];

function RowStatus({ row }: { row: PreviewRow }) {
  if (row.status === "ERROR") return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700"><XCircle className="size-4" aria-hidden="true" /> Error</span>;
  if (row.status === "WARNING") return <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-black text-orange-500"><AlertTriangle className="size-4" aria-hidden="true" /> Revisar</span>;
  if (row.status === "SKIPPED") return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-black text-muted">Omitido</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-black text-success"><CheckCircle2 className="size-4" aria-hidden="true" /> Listo</span>;
}

function MobileRowCard({ row, onEdit, onToggle }: { row: PreviewRow; onEdit: () => void; onToggle: () => void }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 md:hidden">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-muted">Fila {row.rowNumber}</p><h3 className="mt-1 break-words font-black">{row.name || "Sin nombre"}</h3></div><RowStatus row={row} /></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted">Código</dt><dd className="mt-0.5 break-all font-bold">{row.barcode || "—"}</dd></div><div><dt className="text-muted">Venta</dt><dd className="mt-0.5 font-bold">{row.salePriceCents === null ? "—" : formatMoney(row.salePriceCents)}</dd></div><div><dt className="text-muted">Stock</dt><dd className="mt-0.5 font-bold">{row.initialStock ?? "—"}</dd></div><div><dt className="text-muted">Compra</dt><dd className="mt-0.5 font-bold">{row.costPriceCents === null ? "—" : formatMoney(row.costPriceCents)}</dd></div></dl>
      {row.issues.length > 0 && <ul className="mt-4 grid gap-1 text-sm leading-5 text-muted">{row.issues.map((issue) => <li key={issue}>• {issue}</li>)}</ul>}
      <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onEdit} className="button-secondary min-h-11 px-3 py-2"><Pencil className="size-4" aria-hidden="true" /> Corregir</button><button type="button" onClick={onToggle} className="min-h-11 rounded-xl px-3 text-sm font-black text-muted hover:bg-brand-soft hover:text-brand">{row.included ? "Excluir fila" : "Volver a incluir"}</button></div>
    </article>
  );
}

function DesktopPreviewTable({ rows, onEdit, onToggle }: { rows: PreviewRow[]; onEdit: (row: PreviewRow) => void; onToggle: (row: PreviewRow) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
      <table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Fila</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Código</th><th className="px-4 py-3 text-right">Compra</th><th className="px-4 py-3 text-right">Venta</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody className="divide-y divide-line">{rows.map((row) => <tr key={row.id} className="align-top"><td className="px-4 py-4 font-bold text-muted">{row.rowNumber}</td><td className="max-w-52 px-4 py-4"><p className="break-words font-black">{row.name || "Sin nombre"}</p>{row.issues.length > 0 && <p className="mt-1 text-xs leading-5 text-muted">{row.issues.join(" · ")}</p>}</td><td className="max-w-40 break-all px-4 py-4 font-mono text-xs">{row.barcode || "—"}</td><td className="px-4 py-4 text-right font-bold">{row.costPriceCents === null ? "—" : formatMoney(row.costPriceCents)}</td><td className="px-4 py-4 text-right font-bold">{row.salePriceCents === null ? "—" : formatMoney(row.salePriceCents)}</td><td className="px-4 py-4 text-right font-bold">{row.initialStock ?? "—"}</td><td className="px-4 py-4"><RowStatus row={row} /></td><td className="px-4 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={() => onEdit(row)} className="min-h-10 rounded-lg px-3 font-black text-brand hover:bg-brand-soft">Corregir</button><button type="button" onClick={() => onToggle(row)} className="min-h-10 rounded-lg px-3 font-bold text-muted hover:bg-brand-soft hover:text-brand">{row.included ? "Excluir" : "Incluir"}</button></div></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function ImportRowEditor({ importId, row, onClose, onSaved }: { importId: string; row: PreviewRow; onClose: () => void; onSaved: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose, pending]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(undefined);
    const data = new FormData(event.currentTarget);
    const overrides = Object.fromEntries(["NAME", "BARCODE", "COST_PRICE", "SALE_PRICE", "INITIAL_STOCK", "MINIMUM_STOCK", "DESCRIPTION"].map((field) => [field, String(data.get(field) ?? "")]));
    const response = await fetch(`/api/product-imports/${importId}/rows/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overrides, included: true }) });
    const payload = await response.json() as { message?: string };
    if (!response.ok) { setError(payload.message ?? "No pudimos guardar la fila."); setPending(false); return; }
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-ink/55 sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="edit-import-row-title">
      <section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="section-label">Fila {row.rowNumber}</p><h2 id="edit-import-row-title" className="mt-1 text-2xl font-black">Corregir producto</h2></div><button type="button" onClick={onClose} className="min-h-11 rounded-lg px-3 text-sm font-black text-muted hover:bg-brand-soft">Cerrar</button></div>
        <form onSubmit={submit} className="mt-6 grid gap-4" aria-busy={pending}><label className="field-label">Nombre *<input className="field-input" name="NAME" defaultValue={row.editable.NAME} autoComplete="off" autoFocus required /></label><label className="field-label">Descripción<textarea className="field-input min-h-24" name="DESCRIPTION" defaultValue={row.editable.DESCRIPTION} autoComplete="off" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="field-label">Precio de compra *<input className="field-input" name="COST_PRICE" inputMode="decimal" defaultValue={row.editable.COST_PRICE} autoComplete="off" required /></label><label className="field-label">Precio de venta *<input className="field-input" name="SALE_PRICE" inputMode="decimal" defaultValue={row.editable.SALE_PRICE} autoComplete="off" required /></label><label className="field-label">Stock inicial<input className="field-input" name="INITIAL_STOCK" inputMode="numeric" defaultValue={row.editable.INITIAL_STOCK} autoComplete="off" /></label><label className="field-label">Stock mínimo<input className="field-input" name="MINIMUM_STOCK" inputMode="numeric" defaultValue={row.editable.MINIMUM_STOCK} autoComplete="off" /></label></div><label className="field-label">Código de barras<input className="field-input font-mono" name="BARCODE" inputMode="text" defaultValue={row.editable.BARCODE} autoComplete="off" spellCheck={false} /></label>{error && <p className="notice-error" role="alert">{error}</p>}<div className="grid grid-cols-2 gap-2"><button type="button" onClick={onClose} disabled={pending} className="button-secondary">Cancelar</button><button type="submit" disabled={pending} className="button-primary">{pending ? "Guardando…" : "Guardar fila"}</button></div></form>
      </section>
    </div>
  );
}

export function ProductImportWorkflow({ view }: { view: ProductImportView }) {
  const router = useRouter();
  const [mapping, setMapping] = useState(view.mapping);
  const [strategy, setStrategy] = useState(view.existingStrategy);
  const [showMapping, setShowMapping] = useState(view.status === "UPLOADED");
  const [editing, setEditing] = useState<PreviewRow>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function saveMapping() {
    setPending(true); setError(undefined);
    const response = await fetch(`/api/product-imports/${view.id}/mapping`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapping, existingStrategy: strategy }) });
    const payload = await response.json() as { message?: string };
    if (!response.ok) { setError(payload.message ?? "Revisá las correspondencias."); setPending(false); return; }
    setShowMapping(false); setPending(false); router.refresh();
  }

  async function toggleRow(row: PreviewRow) {
    setPending(true); setError(undefined);
    const response = await fetch(`/api/product-imports/${view.id}/rows/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ included: !row.included }) });
    const payload = await response.json() as { message?: string };
    if (!response.ok) setError(payload.message ?? "No pudimos actualizar la fila.");
    setPending(false); router.refresh();
  }

  async function confirmImport() {
    setPending(true); setError(undefined);
    const response = await fetch(`/api/product-imports/${view.id}/confirm`, { method: "POST" });
    const payload = await response.json() as { message?: string };
    if (!response.ok) { setError(payload.message ?? "No pudimos completar la importación."); setPending(false); return; }
    setPending(false); router.refresh();
  }

  async function cancelImport() {
    if (!window.confirm("¿Querés cancelar esta importación? Los productos todavía no fueron modificados.")) return;
    setPending(true);
    const response = await fetch(`/api/product-imports/${view.id}/cancel`, { method: "POST" });
    if (response.ok) router.push("/productos");
    else { const payload = await response.json() as { message?: string }; setError(payload.message ?? "No pudimos cancelar la importación."); setPending(false); }
  }

  if (view.status === "COMPLETED") return <section className="panel"><CheckCircle2 className="size-12 text-success" aria-hidden="true" /><h1 className="text-3xl font-black">Tus productos ya están disponibles</h1><dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4"><div className="bg-surface p-4"><dt className="text-sm text-muted">Nuevos</dt><dd className="mt-1 text-2xl font-black">{view.importedRows}</dd></div><div className="bg-surface p-4"><dt className="text-sm text-muted">Actualizados</dt><dd className="mt-1 text-2xl font-black">{view.updatedRows}</dd></div><div className="bg-surface p-4"><dt className="text-sm text-muted">Omitidos</dt><dd className="mt-1 text-2xl font-black">{view.skippedRows}</dd></div><div className="bg-surface p-4"><dt className="text-sm text-muted">Con error</dt><dd className="mt-1 text-2xl font-black">{view.errorRows}</dd></div></dl><div className="mt-7 grid gap-2 sm:grid-cols-2"><Link href="/productos" className="button-primary">Ver productos</Link><Link href="/productos/importar" className="button-secondary">Importar otro archivo</Link></div></section>;

  if (view.status === "PROCESSING") return <section className="panel" aria-live="polite"><LoaderCircle className="size-11 animate-spin text-brand motion-reduce:animate-none" aria-hidden="true" /><h1 className="text-3xl font-black">Estamos guardando tus productos</h1><p className="mt-3 max-w-xl leading-7 text-muted">No vuelvas a confirmar. Cuando termine, vas a ver el resumen de lo que cambió.</p><button type="button" onClick={() => router.refresh()} className="button-secondary mt-6">Comprobar estado</button></section>;

  if (view.status === "CANCELLED" || view.status === "FAILED") return <section className="panel"><XCircle className="size-11 text-red-700" aria-hidden="true" /><p className="section-label mt-5">{view.status === "CANCELLED" ? "Importación cancelada" : "No se completó la importación"}</p><h1 className="mt-2 text-3xl font-black">{view.status === "CANCELLED" ? "No se modificaron tus productos" : "Podés volver a intentarlo"}</h1><p className="mt-3 max-w-xl leading-7 text-muted">Empezá una nueva carga desde el archivo original.</p><Link href="/productos/importar" className="button-primary mt-6">Nueva importación</Link></section>;

  if (showMapping) return <div><div className="flex items-start gap-3"><FileSpreadsheet className="mt-1 size-7 shrink-0 text-brand" aria-hidden="true" /><div><p className="section-label">{view.originalFilename}</p><h1 className="mt-1 text-balance text-3xl font-black">Decinos qué significa cada columna</h1><p className="page-lead ">DEETA hizo una sugerencia. Revisala antes de continuar.</p></div></div><div className="mt-7 grid gap-3 lg:grid-cols-2">{view.headers.map((header, index) => <label key={`${index}-${header}`} className="panel grid gap-3"><span><span className="text-xs font-bold text-muted">Tu columna</span><strong className="mt-1 block break-words">{header}</strong>{view.rows.slice(0, 2).some((row) => row.rawValues[index]) && <span className="mt-1 block truncate text-xs text-muted">Ej. {view.rows.find((row) => row.rawValues[index])?.rawValues[index]}</span>}</span><span className="field-label">Campo en DEETA<select className="field-input" value={mapping[String(index)] ?? "IGNORE"} onChange={(event) => setMapping((current) => ({ ...current, [String(index)]: event.target.value as ProductImportField }))}>{PRODUCT_IMPORT_FIELDS.map((field) => <option key={field} value={field}>{PRODUCT_IMPORT_FIELD_LABELS[field]}</option>)}</select></span></label>)}</div><fieldset className="panel mt-5"><legend className="font-black">Si el producto ya existe</legend><div className="mt-4 grid gap-2 lg:grid-cols-3">{strategies.map((option) => <label key={option.value} className={`flex min-h-24 cursor-pointer gap-3 rounded-xl border p-4 ${strategy === option.value ? "border-brand bg-brand-soft" : "border-line"}`}><input type="radio" name="strategy" value={option.value} checked={strategy === option.value} onChange={() => setStrategy(option.value)} className="mt-1 size-4" /><span><strong className="block">{option.title}</strong><span className="mt-1 block text-sm leading-5 text-muted">{option.description}</span></span></label>)}</div></fieldset>{error && <p className="notice-error mt-4" role="alert">{error}</p>}<div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><button type="button" onClick={() => void saveMapping()} disabled={pending} className="button-primary sm:order-3">{pending ? "Revisando productos…" : "Revisar productos"}</button>{view.status === "READY" && <button type="button" onClick={() => setShowMapping(false)} className="button-secondary sm:order-2">Volver a la revisión</button>}<button type="button" onClick={() => void cancelImport()} disabled={pending} className="min-h-12 rounded-xl px-4 font-bold text-muted hover:bg-brand-soft hover:text-brand sm:order-1">Cancelar importación</button></div></div>;

  const importable = view.readyRows + view.warningRows;
  return <div><button type="button" onClick={() => setShowMapping(true)} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Corregir correspondencias</button><p className="section-label mt-5">{view.originalFilename}</p><h1 className="mt-2 text-balance text-3xl font-black sm:text-4xl">Revisá antes de importar</h1><p className="mt-2 text-pretty leading-7 text-muted">Los productos con error no se importarán. Podés corregirlos acá o continuar con los demás.</p><section className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line"><div className="bg-surface p-4 sm:p-5"><p className="text-2xl font-black text-success">{view.readyRows}</p><p className="mt-1 text-xs font-bold text-muted sm:text-sm">Listos</p></div><div className="bg-surface p-4 sm:p-5"><p className="text-2xl font-black text-orange-500">{view.warningRows}</p><p className="mt-1 text-xs font-bold text-muted sm:text-sm">Revisar</p></div><div className="bg-surface p-4 sm:p-5"><p className="text-2xl font-black text-red-700">{view.errorRows}</p><p className="mt-1 text-xs font-bold text-muted sm:text-sm">Con error</p></div></section><div className="mt-7 grid gap-3">{view.rows.map((row) => <MobileRowCard key={row.id} row={row} onEdit={() => setEditing(row)} onToggle={() => void toggleRow(row)} />)}</div><div className="mt-7"><DesktopPreviewTable rows={view.rows} onEdit={setEditing} onToggle={(row) => void toggleRow(row)} /></div>{view.totalRows > view.rows.length && <p className="mt-4 text-sm text-muted">Mostramos {view.rows.length} filas prioritarias de {view.totalRows.toLocaleString("es-UY")}. Todas fueron validadas.</p>}{error && <p className="notice-error mt-5" role="alert">{error}</p>}<section className="panel mt-6"><p className="font-black">Listo para importar</p><p className="mt-1 text-sm leading-6 text-muted">Se procesarán {importable.toLocaleString("es-UY")} filas válidas. Las filas con error quedarán fuera.</p><div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]"><button type="button" onClick={() => void confirmImport()} disabled={pending || importable === 0} className="button-primary sm:order-2">{pending ? `Importando ${importable.toLocaleString("es-UY")} productos…` : "Confirmar importación"}</button><button type="button" onClick={() => void cancelImport()} disabled={pending} className="button-secondary sm:order-1">Cancelar importación</button></div></section>{editing && <ImportRowEditor importId={view.id} row={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); router.refresh(); }} />}</div>;
}
