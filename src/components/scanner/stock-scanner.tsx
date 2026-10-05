"use client";

import { Camera, PackagePlus, Search } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { lookupBarcodeAction } from "@/actions/scanner";
import { stockMovementAction, type ProductFormState } from "@/actions/products";
import { BarcodeScanner } from "@/components/scanner/barcode-scanner";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import type { ScannerProductDto } from "@/data/scanner";
import type { ScannedBarcode } from "@/lib/barcode";

export function StockScanner() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ScannerProductDto>();
  const [missingBarcode, setMissingBarcode] = useState<string>();

  async function detected(scan: ScannedBarcode) {
    setOpen(false); setLoading(true); setMissingBarcode(undefined);
    const result = await lookupBarcodeAction({ barcode: scan.value });
    setLoading(false);
    if (result.ok) setProduct(result.product);
    else if (result.reason === "NOT_FOUND") setMissingBarcode(result.barcode);
  }
  function next() { setProduct(undefined); setMissingBarcode(undefined); setOpen(true); }

  return <div><button type="button" onClick={() => setOpen(true)} className="button-primary w-full"><Camera className="size-5" /> Escanear producto</button>{loading && <p className="panel mt-5 text-center font-bold text-muted">Buscando producto…</p>}{product && <StockEntryForm key={product.id} product={product} onNext={next} />}{missingBarcode && <section className="panel mt-5 text-center"><Search className="mx-auto size-9 text-muted" /><h2 className="mt-4 text-xl font-black">No encontramos este producto</h2><p className="mt-2 text-sm text-muted">Código: {missingBarcode}</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Link href={`/productos/nuevo?barcode=${encodeURIComponent(missingBarcode)}`} className="button-primary"><PackagePlus className="size-5" /> Crear producto</Link><button type="button" onClick={next} className="button-secondary">Volver a escanear</button></div><Link href="/productos" className="mt-4 inline-block text-sm font-bold text-muted underline">Buscar manualmente</Link></section>}<BarcodeScanner open={open} onClose={() => setOpen(false)} onDetected={detected} /></div>;
}

function StockEntryForm({ product, onNext }: { product: ScannerProductDto; onNext: () => void }) {
  const [state, action] = useActionState(stockMovementAction, { status: "idle" } satisfies ProductFormState);
  return <section className="panel mt-5"><p className="text-sm font-bold text-success">Producto reconocido</p><h2 className="mt-1 text-2xl font-black">{product.name}</h2><p className="mt-2 text-muted">Stock actual: <strong className="text-ink">{state.stockResult?.resultingStock ?? product.currentStock}</strong></p>{state.status === "success" ? <><div className="notice-success mt-5">{state.message}<p className="mt-1 font-black">{state.stockResult?.previousStock} → {state.stockResult?.resultingStock}</p></div><button type="button" onClick={onNext} className="button-primary mt-5 w-full"><Camera className="size-5" /> Escanear siguiente producto</button></> : <form action={action} className="mt-5"><input type="hidden" name="productId" value={product.id} /><input type="hidden" name="type" value="IN" /><input type="hidden" name="reason" value="Ingreso mediante código de barras" /><label className="field-label">¿Cuántas unidades entraron?<input name="amount" type="number" inputMode="numeric" min="1" step="1" className="field-input" placeholder="0" autoFocus required /></label>{state.message && <p className="notice-error mt-4">{state.message}</p>}<ActionSubmitButton className="button-primary mt-5 w-full" pendingLabel="Actualizando…">Confirmar ingreso</ActionSubmitButton></form>}</section>;
}
