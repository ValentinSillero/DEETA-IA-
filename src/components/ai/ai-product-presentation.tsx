import { AlertTriangle, Boxes, CircleGauge, PackageCheck, PackageX, TrendingDown } from "lucide-react";

import type { AiProductPresentation as AiProductPresentationData, AiProductPresentationItem, AiProductStatus } from "@/lib/ai/presentation";

const statusDetails: Record<AiProductStatus, { label: string; className: string; icon: typeof PackageX }> = {
  out_of_stock: { label: "Sin stock", className: "border-red-200 bg-red-50 text-red-800", icon: PackageX },
  low_stock: { label: "Bajo stock", className: "border-orange-200 bg-orange-100 text-[#7b3f22]", icon: AlertTriangle },
  urgent_restock: { label: "Reposición urgente", className: "border-red-200 bg-red-50 text-red-800", icon: AlertTriangle },
  restock_soon: { label: "Reponer pronto", className: "border-orange-200 bg-orange-100 text-[#7b3f22]", icon: CircleGauge },
  slow_moving: { label: "Baja rotación", className: "border-line bg-surface-2 text-ink", icon: TrendingDown },
  excess_stock: { label: "Mucho stock para su ritmo de venta", className: "border-brand/20 bg-brand-soft text-ink", icon: Boxes },
  sufficient_stock: { label: "Stock suficiente", className: "border-emerald-200 bg-emerald-50 text-success", icon: PackageCheck },
};

function units(value: number) {
  return `${value.toLocaleString("es-AR")} ${value === 1 ? "unidad" : "unidades"}`;
}

function Metric({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return <div className={primary ? "col-span-full min-w-0" : "min-w-0"}>
    <dt className="text-[0.7rem] font-black text-muted">{label}</dt>
    <dd className={primary ? "mt-1 break-words text-lg font-black leading-tight text-ink" : "mt-1 break-words text-sm font-extrabold text-ink"}>{value}</dd>
  </div>;
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date).replace(".", "")
    : value;
}

function ProductMetrics({ item, variant }: { item: AiProductPresentationItem; variant: AiProductPresentationData["variant"] }) {
  if (["top-selling", "least-selling", "no-sales", "top-revenue", "least-revenue"].includes(variant)) return <dl className="mt-3 grid min-w-0 grid-cols-1 gap-3 min-[390px]:grid-cols-2">
    {item.unitsSold !== undefined ? <Metric label="Unidades vendidas" value={units(item.unitsSold)} primary={!variant.includes("revenue")} /> : null}
    {item.sales ? <Metric label="Ventas" value={item.sales} primary={variant.includes("revenue")} /> : null}
    {item.currentStock !== undefined ? <Metric label="Stock actual" value={units(item.currentStock)} /> : null}
    {item.lastSaleDate ? <Metric label="Última venta" value={dateLabel(item.lastSaleDate)} /> : null}
    {item.daysWithoutSales !== undefined && item.daysWithoutSales !== null ? <Metric label="Días sin ventas" value={`${item.daysWithoutSales.toLocaleString("es-AR")} días`} /> : null}
  </dl>;
  if (variant === "top-margin" || variant === "top-margin-percent" || variant === "low-margin") return <dl className="mt-3 grid min-w-0 grid-cols-1 gap-3 min-[390px]:grid-cols-2">
    {variant === "top-margin-percent" && item.marginPercent !== undefined && item.marginPercent !== null
      ? <Metric label="Porcentaje de margen" value={`${item.marginPercent.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`} primary />
      : item.grossMargin ? <Metric label="Margen generado" value={item.grossMargin} primary /> : null}
    {item.unitsSold !== undefined ? <Metric label="Unidades vendidas" value={units(item.unitsSold)} /> : null}
    {item.sales ? <Metric label="Ventas" value={item.sales} /> : null}
    {item.cogs ? <Metric label="Costo histórico" value={item.cogs} /> : null}
    {variant !== "top-margin-percent" && item.marginPercent !== undefined && item.marginPercent !== null ? <Metric label="Porcentaje de margen" value={`${item.marginPercent.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`} /> : null}
  </dl>;
  const soldLabel = variant === "stock" || variant === "reorder"
    ? `Ventas últimos ${item.periodDays ?? 30} días`
    : `Vendidas en ${item.periodDays ?? 30} días`;
  return <dl className="mt-3 grid min-w-0 grid-cols-1 gap-3 min-[390px]:grid-cols-2">
    {item.currentStock !== undefined ? <Metric label="Stock actual" value={units(item.currentStock)} primary /> : null}
    {item.minimumStock !== undefined ? <Metric label="Stock mínimo" value={units(item.minimumStock)} /> : null}
    {item.unitsSold !== undefined ? <Metric label={soldLabel} value={units(item.unitsSold)} /> : null}
    {item.coverageDays !== undefined && item.coverageDays !== null ? <Metric label="Cobertura estimada" value={`${item.coverageDays.toLocaleString("es-AR", { maximumFractionDigits: 1 })} días`} /> : null}
  </dl>;
}

function ProductCard({ item, presentation }: { item: AiProductPresentationItem; presentation: AiProductPresentationData }) {
  const status = item.status ? statusDetails[item.status] : null;
  const StatusIcon = status?.icon;
  return <li className="min-w-0 px-4 py-4 sm:px-5">
    <h4 className="break-words text-base font-black leading-snug text-ink">{item.productName}</h4>
    <ProductMetrics item={item} variant={presentation.variant} />
    {status && StatusIcon ? <div className="mt-3">
      <span className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-extrabold leading-4 ${status.className}`}>
        <StatusIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>{status.label}</span>
      </span>
    </div> : null}
  </li>;
}

export function AiProductPresentation({ presentation }: { presentation: AiProductPresentationData }) {
  return <section className="mt-4 min-w-0 overflow-hidden rounded-xl border border-line bg-surface" aria-label={presentation.title}>
    <header className="border-b border-line px-4 py-3 sm:px-5">
      <p className="text-sm font-black text-ink">{presentation.title}</p>
      {presentation.periodLabel ? <p className="mt-0.5 text-xs font-semibold text-muted">{presentation.periodLabel}</p> : null}
    </header>
    <ul className="min-w-0 divide-y divide-line">
      {presentation.items.map((item, index) => <ProductCard key={`${item.productName}-${index}`} item={item} presentation={presentation} />)}
    </ul>
    {presentation.note ? <p className="border-t border-line px-4 py-3 text-xs font-semibold leading-5 text-muted sm:px-5">{presentation.note}</p> : null}
  </section>;
}
