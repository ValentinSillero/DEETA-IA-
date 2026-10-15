"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, FormEvent, useRef, useState } from "react";

import { PRODUCT_IMPORT_LIMITS } from "@/lib/product-import-contract";

export function ProductImportUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  function chooseFile(selected: File | undefined) {
    setFile(selected ?? null);
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setError(undefined);
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetch("/api/product-imports", { method: "POST", body });
      const payload = await response.json() as { importId?: string; message?: string };
      if (!response.ok || !payload.importId) throw new Error(payload.message ?? "No pudimos subir el archivo.");
      router.push(`/productos/importar/${payload.importId}` as Route);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos subir el archivo. Intentá nuevamente.");
      setPending(false);
    }
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  return (
    <form onSubmit={submit} className="mt-7">
      <label
        className={`grid min-h-64 cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition-colors ${dragging ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand hover:bg-brand-soft/40"}`}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          name="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
        <span>
          <span className="icon-box mx-auto size-14"><Upload className="size-7" aria-hidden="true" /></span>
          <span className="mt-5 block text-xl font-black">Seleccionar archivo</span>
          <span className="mt-2 block text-sm leading-6 text-muted">Excel `.xlsx` o CSV `.csv` · hasta {PRODUCT_IMPORT_LIMITS.maxFileBytes / 1024 / 1024} MB · máximo {PRODUCT_IMPORT_LIMITS.maxRows.toLocaleString("es-UY")} productos</span>
          <span className="mt-3 hidden text-sm font-bold text-brand sm:block">También podés arrastrarlo hasta acá</span>
        </span>
      </label>

      {file && (
        <div className="mt-4 flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-4" aria-live="polite">
          <FileSpreadsheet className="size-6 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="truncate font-black">{file.name}</p><p className="text-sm text-muted">{(file.size / 1024).toLocaleString("es-UY", { maximumFractionDigits: 1 })} KB</p></div>
          <button type="button" onClick={() => { chooseFile(undefined); if (inputRef.current) inputRef.current.value = ""; }} className="min-h-11 rounded-lg px-3 text-sm font-bold text-muted hover:bg-brand-soft hover:text-brand">Quitar</button>
        </div>
      )}
      {error && <p className="notice-error mt-4" role="alert">{error}</p>}
      <button type="submit" disabled={!file || pending} className="button-primary mt-5 w-full sm:w-auto">{pending ? "Leyendo archivo…" : "Continuar"}</button>

      <div className="mt-7 border-t border-line pt-6">
        <p className="font-black">¿Preferís empezar con una plantilla?</p>
        <p className="mt-1 text-sm leading-6 text-muted">Incluye los nombres de columna recomendados y un ejemplo que podés borrar.</p>
        <Link href="/api/product-imports/template" prefetch={false} className="button-secondary mt-4"><Download className="size-5" aria-hidden="true" /> Descargar plantilla CSV</Link>
      </div>
    </form>
  );
}
