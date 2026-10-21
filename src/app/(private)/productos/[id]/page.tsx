import { ArrowLeft, Barcode, Edit3, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductActiveForm } from "@/components/products/product-active-form";
import { ProductDeleteForm } from "@/components/products/product-delete-form";
import { StockManager } from "@/components/products/stock-manager";
import { StockStatusBadge } from "@/components/products/stock-status-badge";
import { canDeleteFromMovements, getMovementsForUser, getProductForUser } from "@/data/products";
import { formatMoney, formatMovementQuantity } from "@/lib/inventory";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Detalle del producto" };

const movementLabels = {
  INITIAL: "Stock inicial",
  IN: "Ingreso de mercadería",
  OUT: "Salida manual",
  ADJUSTMENT: "Ajuste de cantidad",
  SALE: "Venta",
  PURCHASE: "Compra",
  RETURN: "Devolución",
} as const;

function localDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateLabel(date: Date) {
  const today = localDateKey(new Date());
  const yesterday = localDateKey(new Date(Date.now() - 86_400_000));
  const key = localDateKey(date);
  if (key === today) return "Hoy";
  if (key === yesterday) return "Ayer";
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "PRODUCT_VIEW")) return <NoAccess section="Productos" />;
  const membership = await getActiveMembership(session.user.id);
  // El costo y la ganancia por unidad son información de rentabilidad.
  const showCost = can(membership, "PROFITABILITY_VIEW") || can(membership, "PRODUCT_PRICE_EDIT");
  const { id } = await params;
  const [record, movements] = await Promise.all([
    getProductForUser(session.user.id, id),
    getMovementsForUser(session.user.id, id),
  ]);
  if (!record) notFound();
  const item = record.product;
  const margin = item.salePriceCents - item.costPriceCents;
  // Solo orienta a la interfaz: el servidor vuelve a revisar todo al eliminar.
  const deletable = canDeleteFromMovements(movements.map(({ movement }) => movement));

  const groups = movements.reduce<Map<string, typeof movements>>((map, movement) => {
    const label = dateLabel(movement.movement.createdAt);
    map.set(label, [...(map.get(label) ?? []), movement]);
    return map;
  }, new Map());

  return (
    <div>
      <Link href="/productos" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Volver a productos</Link>
      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.isActive ? <StockStatusBadge currentStock={item.currentStock} minimumStock={item.minimumStock} /> : <span className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-extrabold text-muted">Desactivado</span>}
          </div>
          <h1 className="mt-3 page-title break-words">{item.name}</h1>
          {item.description && <p className="mt-3 max-w-2xl leading-7 text-muted">{item.description}</p>}
        </div>
        {can(membership, "PRODUCT_EDIT") && <Link href={`/productos/${item.id}/editar`} className="button-secondary shrink-0"><Edit3 className="size-4" aria-hidden="true" /> Editar información</Link>}
      </div>

      <section className={`mt-7 grid gap-3 ${showCost ? "sm:grid-cols-3" : ""}`}>
        {showCost && <div className="rounded-2xl border border-line bg-white p-4 sm:p-5"><p className="text-xs font-bold text-muted">Precio de compra</p><p className="mt-2 text-xl font-black">{formatMoney(item.costPriceCents)}</p></div>}
        <div className="rounded-2xl border border-line bg-white p-4 sm:p-5"><p className="text-xs font-bold text-muted">Precio de venta</p><p className="mt-2 text-xl font-black text-mint-600">{formatMoney(item.salePriceCents)}</p></div>
        {showCost && <div className="rounded-2xl border border-line bg-white p-4 sm:p-5"><p className="text-xs font-bold text-muted">Ganancia estimada por unidad</p><p className={`mt-2 text-xl font-black ${margin < 0 ? "text-red-700" : ""}`}>{formatMoney(margin)}</p></div>}
      </section>

      {item.barcode && <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-muted"><Barcode className="size-4" /> {item.barcode}</p>}

      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="space-y-5">
          {!can(membership, "STOCK_ADJUST") ? null : item.isActive ? (
            <StockManager productId={item.id} currentStock={item.currentStock} minimumStock={item.minimumStock} />
          ) : (
            <section className="panel"><h2 className="text-lg font-black">Producto desactivado</h2><p className="mt-2 text-sm leading-6 text-muted">Reactivá el producto para volver a registrar movimientos.</p></section>
          )}
          {(can(membership, "PRODUCT_EDIT") || can(membership, "PRODUCT_DELETE")) && (
            <section className="panel space-y-3" aria-labelledby="product-actions-title">
              <h2 id="product-actions-title" className="text-lg font-black">Acciones</h2>
              {can(membership, "PRODUCT_EDIT") && <ProductActiveForm productId={item.id} isActive={item.isActive} />}
              {can(membership, "PRODUCT_DELETE") && (deletable ? (
                <ProductDeleteForm productId={item.id} productName={item.name} />
              ) : (
                <p className="text-sm leading-6 text-muted">Este producto tiene movimientos, por eso no se puede eliminar. Desactivarlo conserva su historial.</p>
              ))}
            </section>
          )}
        </div>

        <section className="panel min-w-0">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3ff] text-[#506ca8]"><History className="size-5" /></span><div><h2 className="text-xl font-black">Movimientos</h2><p className="text-sm text-muted">El historial de este producto</p></div></div>
          {movements.length === 0 ? (
            <div className="mt-8 rounded-2xl bg-surface-2 px-4 py-8 text-center text-sm text-muted">Todavía no hay movimientos.</div>
          ) : (
            <div className="mt-7 space-y-7">
              {[...groups.entries()].map(([label, entries]) => (
                <div key={label}>
                  <p className="text-xs font-extrabold text-muted">{label}</p>
                  <div className="mt-3 divide-y divide-line/70">
                    {entries.map(({ movement, createdByName }) => (
                      <article key={movement.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-black ${movement.quantity > 0 ? "bg-accent-soft text-success" : movement.quantity < 0 ? "bg-red-50 text-red-700" : "bg-surface-2 text-muted"}`}>{formatMovementQuantity(movement.quantity)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3"><p className="font-extrabold">{movementLabels[movement.type]}</p><time className="shrink-0 text-xs font-semibold text-muted">{new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit" }).format(movement.createdAt)}</time></div>
                          <p className="mt-1 text-sm text-muted">Stock resultante: <strong className="text-ink">{movement.resultingStock}</strong></p>
                          {movement.reason && <p className="mt-1 break-words text-sm text-muted">{movement.reason}</p>}
                          <p className="mt-1 text-xs text-[#8c8fa5]">Por {createdByName}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
