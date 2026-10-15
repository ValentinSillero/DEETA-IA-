"use client";

import { Banknote, Camera, CreditCard, Minus, PackagePlus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { lookupBarcodeAction } from "@/actions/scanner";
import { completeSaleAction } from "@/actions/sales";
import { RemoteScannerPanel } from "@/components/scanner/remote-scanner-panel";
import type { ScannerProductDto } from "@/data/scanner";
import type { SaleProductDto } from "@/data/sales";
import type { ScannedBarcode } from "@/lib/barcode";
import { formatMoney } from "@/lib/inventory";
import { parseMoneyToCents } from "@/lib/product-validations";

type CartLine = SaleProductDto & { quantity: number };
type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

const BarcodeScanner = dynamic(
  () => import("@/components/scanner/barcode-scanner").then((module) => module.BarcodeScanner),
  { ssr: false },
);

export function SaleComposer({ products, hasOpenCash }: { products: SaleProductDto[]; hasOpenCash: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [mobileCart, setMobileCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [received, setReceived] = useState("");
  const [error, setError] = useState<string>();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<{ message: string; barcode?: string; missing?: boolean }>();
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    if (!query) return products;
    return products.filter((product) => product.name.toLocaleLowerCase("es").includes(query) || product.barcode?.includes(query));
  }, [products, search]);
  const totalCents = cart.reduce((total, line) => total + line.salePriceCents * line.quantity, 0);
  const units = cart.reduce((total, line) => total + line.quantity, 0);
  const receivedCents = received ? parseMoneyToCents(received) : Number.NaN;
  const changeCents = Number.isFinite(receivedCents) ? receivedCents - totalCents : null;

  useEffect(() => {
    if (!mobileCart && !checkout) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [checkout, mobileCart]);

  function add(product: SaleProductDto) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (!existing) return [...current, { ...product, quantity: 1 }];
      if (existing.quantity >= product.currentStock) return current;
      return current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
    });
  }

  function addScanned(product: SaleProductDto | ScannerProductDto) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      const quantity = existing?.quantity ?? 0;
      if (quantity >= product.currentStock) {
        setScanNotice({ message: "No hay más unidades disponibles.", barcode: product.barcode ?? undefined });
        return current;
      }
      setScanNotice({ message: `${product.name} agregado.`, barcode: product.barcode ?? undefined });
      if (!existing) return [...current, { ...product, barcode: product.barcode ?? null, quantity: 1 }];
      return current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
    });
  }

  async function scanned(scan: ScannedBarcode) {
    const result = await lookupBarcodeAction({ barcode: scan.value });
    if (result.ok) addScanned(result.product);
    else {
      setScannerOpen(false);
      setScanNotice({ message: "No encontramos este producto.", barcode: result.reason === "NOT_FOUND" ? result.barcode : scan.value, missing: true });
    }
  }

  function changeQuantity(id: string, difference: number) {
    setCart((current) => current
      .map((line) => line.id === id ? { ...line, quantity: Math.min(line.currentStock, line.quantity + difference) } : line)
      .filter((line) => line.quantity > 0));
  }

  function charge() {
    setError(undefined);
    startTransition(async () => {
      const result = await completeSaleAction({
        items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
        paymentMethod,
        receivedCashCents: paymentMethod === "CASH" && Number.isFinite(receivedCents) ? receivedCents : null,
        pairingSessionId: pairingId,
      });
      if (!result.ok) return setError(result.message);
      router.push(`/ventas/${result.saleId}?creada=1`);
      router.refresh();
    });
  }

  const cartContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-bold">Carrito</h2><p className="text-sm text-muted">{units || "Sin"} {units === 1 ? "unidad" : "unidades"}</p></div>
        <button type="button" onClick={() => setMobileCart(false)} className="grid size-11 place-items-center rounded-xl border border-line lg:hidden" aria-label="Cerrar carrito"><X className="size-5" aria-hidden="true" /></button>
      </div>
      {cart.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center py-10 text-center text-muted"><div><ShoppingCart className="mx-auto size-9" /><p className="mt-3 font-bold">Agregá productos para empezar.</p></div></div>
      ) : (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" aria-label="Productos en el carrito">
          {cart.map((line) => (
            <div key={line.id} className="border-b border-line py-4 first:pt-0 last:border-0">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-extrabold">{line.name}</p><p className="mt-1 text-sm text-muted">{formatMoney(line.salePriceCents)} c/u</p></div><button type="button" onClick={() => setCart((items) => items.filter((item) => item.id !== line.id))} className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-red-700" aria-label={`Quitar ${line.name}`}><Trash2 className="size-5" /></button></div>
              <div className="mt-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><button type="button" onClick={() => changeQuantity(line.id, -1)} className="grid size-11 place-items-center rounded-xl border border-line" aria-label={`Restar una unidad de ${line.name}`}><Minus className="size-4" /></button><span className="w-7 text-center font-black">{line.quantity}</span><button type="button" onClick={() => changeQuantity(line.id, 1)} disabled={line.quantity >= line.currentStock} className="grid size-11 place-items-center rounded-xl border border-line disabled:opacity-35" aria-label={`Sumar una unidad de ${line.name}`}><Plus className="size-4" /></button></div><p className="shrink-0 font-black">{formatMoney(line.salePriceCents * line.quantity)}</p></div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto shrink-0 bg-surface pt-3"><div className="ledger-total"><p className="font-semibold">Total</p><p className="figure min-w-0 break-words text-right text-[2rem] leading-none">{formatMoney(totalCents)}</p></div><button type="button" onClick={() => setCheckout(true)} disabled={!cart.length} className="button-brand mt-4 min-h-14 w-full text-base">Cobrar venta</button></div>
    </div>
  );

  return (
    <>
      <div className="grid min-w-0 gap-6 lg:h-[clamp(520px,calc(100dvh_-_15rem),760px)] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <section className="min-w-0 lg:flex lg:min-h-0 lg:flex-col">
          <div className="shrink-0">
            <div className="grid gap-2 sm:grid-cols-2"><label className="relative block sm:col-span-2"><span className="sr-only">Buscar producto por nombre o código</span><Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="field-input min-h-13 pl-11 text-[1.05rem]" placeholder="Buscar por nombre o código…" autoComplete="off" autoFocus /></label><button type="button" onClick={() => setScannerOpen(true)} className="button-primary w-full"><Camera className="size-5" aria-hidden="true" /> Escanear</button><div className="min-w-0"><RemoteScannerPanel onProduct={addScanned} onPairingChange={setPairingId} /></div></div>
            {scanNotice && <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-bold ${scanNotice.missing ? "border border-orange-200 bg-orange-50 text-[#9a531d]" : "bg-accent-soft text-success"}`} role="status"><p>{scanNotice.message}</p>{scanNotice.barcode && <p className="mt-1 font-mono text-xs">{scanNotice.barcode}</p>}{scanNotice.missing && <div className="mt-3 flex flex-wrap gap-2"><Link href={`/productos/nuevo?barcode=${encodeURIComponent(scanNotice.barcode ?? "")}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-ink px-3 text-white"><PackagePlus className="size-4" /> Crear producto</Link><button type="button" onClick={() => { setScanNotice(undefined); setScannerOpen(true); }} className="rounded-xl border border-orange-200 bg-white px-3">Volver a escanear</button></div>}</div>}
          </div>
          <div className="list-surface mt-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            {visibleProducts.map((product) => {
              const inCart = cart.find((line) => line.id === product.id)?.quantity ?? 0;
              return <article key={product.id} className="list-row bg-surface"><div className="min-w-0 flex-1"><h2 className="truncate font-sans text-[0.98rem] font-semibold tracking-normal">{product.name}</h2><div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1"><p className="figure text-base">{formatMoney(product.salePriceCents)}</p><p className="text-sm text-muted">{product.currentStock} disp.</p>{inCart > 0 && <p className="text-sm font-semibold text-brand">{inCart} en carrito</p>}</div></div><button type="button" onClick={() => add(product)} disabled={inCart >= product.currentStock} className="grid size-12 shrink-0 place-items-center rounded-lg bg-ink text-white transition-colors hover:bg-ink-soft active:translate-y-px disabled:opacity-35" aria-label={`Agregar ${product.name}`}><Plus className="size-5" aria-hidden="true" /></button></article>;
            })}
          </div>
          {visibleProducts.length === 0 && <div className="panel mt-5 text-center"><p className="font-bold">No encontramos productos con stock.</p><p className="mt-2 text-sm text-muted">Probá otra búsqueda.</p></div>}
        </section>
        <aside className="panel sticky top-6 hidden min-h-0 overflow-hidden lg:flex">{cartContent}</aside>
      </div>

      {cart.length > 0 ? <button type="button" onClick={() => setMobileCart(true)} className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-5 left-3 right-3 z-30 flex min-h-16 items-center justify-between gap-3 rounded-xl border border-white/15 bg-ink px-4 text-white lg:hidden" aria-label={`Ver carrito: ${units} ${units === 1 ? "producto" : "productos"}, total ${formatMoney(totalCents)}`}><span className="min-w-0 text-left font-black"><ShoppingCart className="mr-2 inline size-5" aria-hidden="true" />{units} {units === 1 ? "producto" : "productos"}</span><span className="shrink-0 text-right"><span className="block text-lg font-black">{formatMoney(totalCents)}</span><span className="block text-xs font-bold text-white/70">Ver carrito</span></span></button> : null}
      {mobileCart ? <div className="fixed inset-0 z-50 flex items-end overflow-hidden overscroll-none bg-ink/45 lg:hidden" onMouseDown={(event) => event.currentTarget === event.target && setMobileCart(false)}><div className="flex h-[min(88dvh,720px)] min-h-0 w-full flex-col overflow-hidden rounded-t-2xl bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-label="Carrito de venta">{cartContent}</div></div> : null}

      {checkout && <div className="fixed inset-0 z-[60] grid place-items-end bg-ink/50 p-0 sm:place-items-center sm:p-5"><div className="w-full max-w-lg rounded-t-2xl bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><div className="flex items-start justify-between"><div><p className="section-label">Cobrar</p><h2 id="checkout-title" className="figure mt-1 text-[2.25rem] leading-none">{formatMoney(totalCents)}</h2></div><button type="button" onClick={() => setCheckout(false)} className="grid size-11 place-items-center rounded-xl border border-line" aria-label="Cerrar cobro"><X className="size-5" aria-hidden="true" /></button></div>
        <fieldset className="mt-6"><legend className="font-semibold">¿Cómo pagó?</legend><div className="mt-3 grid grid-cols-3 gap-2">{([{ value: "CASH", label: "Efectivo", icon: Banknote }, { value: "TRANSFER", label: "Transferencia", icon: Banknote }, { value: "CARD", label: "Tarjeta", icon: CreditCard }] as const).map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => { setPaymentMethod(value); setError(undefined); }} aria-pressed={paymentMethod === value} className={`min-h-16 rounded-lg border px-2 text-sm font-semibold transition-colors ${paymentMethod === value ? "border-ink bg-ink text-white" : "border-line-strong hover:bg-surface-2"}`}><Icon className="mx-auto mb-2 size-5" />{label}</button>)}</div></fieldset>
        {paymentMethod === "CASH" && (!hasOpenCash ? <div className="notice-error mt-5">Primero tenés que abrir la caja. <Link href="/caja" className="underline">Abrir caja</Link></div> : <div className="mt-5"><label className="field-label">Recibí<input value={received} onChange={(event) => setReceived(event.target.value)} inputMode="decimal" className="field-input" placeholder="$ 0" /></label>{changeCents !== null && changeCents >= 0 && <p className="mt-3 rounded-2xl bg-accent-soft p-4 font-black text-success">Vuelto: {formatMoney(changeCents)}</p>}</div>)}
        {error && <p className="notice-error mt-5">{error}</p>}
        <button type="button" onClick={charge} disabled={pending || (paymentMethod === "CASH" && (!hasOpenCash || changeCents === null || changeCents < 0))} className="button-brand mt-6 min-h-14 w-full text-base">{pending ? "Cobrando…" : "Confirmar venta"}</button>
      </div></div>}
      {scannerOpen ? <BarcodeScanner open onClose={() => setScannerOpen(false)} onDetected={scanned} /> : null}
    </>
  );
}
