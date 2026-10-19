import { AlertTriangle, Boxes, CircleGauge, Package, PackageCheck, PackageX, TrendingDown } from "lucide-react";

import { AiResult } from "@/components/ai/ai-result";
import type { AiProductPresentation as AiProductPresentationData, AiProductPresentationItem, AiProductStatus } from "@/lib/ai/presentation";

// Estado con ícono y texto, no solo color.
const statusDetails: Record<AiProductStatus, { label: string; className: string; icon: typeof PackageX }> = {
  out_of_stock: { label: "Sin stock", className: "text-red-700", icon: PackageX },
  low_stock: { label: "Stock bajo", className: "text-[#a8530f]", icon: AlertTriangle },
  urgent_restock: { label: "Reponer ya", className: "text-red-700", icon: AlertTriangle },
  restock_soon: { label: "Reponer pronto", className: "text-[#a8530f]", icon: CircleGauge },
  slow_moving: { label: "Se vende poco", className: "text-muted", icon: TrendingDown },
  excess_stock: { label: "Mucho stock para lo que vendés", className: "text-muted", icon: Boxes },
  sufficient_stock: { label: "Stock suficiente", className: "text-success", icon: PackageCheck },
};

function units(value: number) {
  return `${value.toLocaleString("es-AR")} ${value === 1 ? "unidad" : "unidades"}`;
}

function percent(value: number) {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short", timeZone: "UTC" }).format(date).replace(".", "")
    : value;
}

// El dato que responde la pregunta va a la derecha; el resto, en una línea secundaria.
function figures(item: AiProductPresentationItem, variant: AiProductPresentationData["variant"]) {
  const days = item.periodDays ?? 30;
  const sold = item.unitsSold !== undefined ? `Vendidas en ${days} días: ${item.unitsSold.toLocaleString("es-AR")}` : null;
  if (variant === "top-selling" || variant === "least-selling" || variant === "no-sales") {
    const main = variant === "no-sales" && item.daysWithoutSales != null
      ? { value: `${item.daysWithoutSales.toLocaleString("es-AR")} días`, label: "sin ventas" }
      : item.unitsSold !== undefined ? { value: units(item.unitsSold), label: "vendidas" } : null;
    return { main, secondary: [
      item.sales ? `Ventas ${item.sales}` : null,
      item.currentStock !== undefined ? `Stock ${item.currentStock.toLocaleString("es-AR")}` : null,
      item.lastSaleDate ? `Última venta ${dateLabel(item.lastSaleDate)}` : null,
    ] };
  }
  if (variant === "top-revenue" || variant === "least-revenue") {
    return { main: item.sales ? { value: item.sales, label: "en ventas" } : null, secondary: [
      item.unitsSold !== undefined ? `${units(item.unitsSold)} vendidas` : null,
      item.currentStock !== undefined ? `Stock ${item.currentStock.toLocaleString("es-AR")}` : null,
    ] };
  }
  if (variant === "top-margin" || variant === "top-margin-percent" || variant === "low-margin") {
    const byPercent = variant !== "top-margin" && item.marginPercent != null;
    return {
      main: byPercent ? { value: percent(item.marginPercent!), label: "de margen" } : item.grossMargin ? { value: item.grossMargin, label: "de margen" } : null,
      secondary: [
        byPercent && item.grossMargin ? `Margen ${item.grossMargin}` : null,
        !byPercent && item.marginPercent != null ? `${percent(item.marginPercent)} de margen` : null,
        item.sales ? `Ventas ${item.sales}` : null,
        item.cogs ? `Costo ${item.cogs}` : null,
        item.unitsSold !== undefined ? `${units(item.unitsSold)} vendidas` : null,
      ],
    };
  }
  return {
    main: item.currentStock !== undefined ? { value: units(item.currentStock), label: "en stock" } : null,
    secondary: [
      item.minimumStock !== undefined ? `Mínimo ${item.minimumStock.toLocaleString("es-AR")}` : null,
      sold,
      item.coverageDays != null ? `Alcanza para ${item.coverageDays.toLocaleString("es-AR", { maximumFractionDigits: 1 })} días` : null,
    ],
  };
}

function ProductRow({ item, variant }: { item: AiProductPresentationItem; variant: AiProductPresentationData["variant"] }) {
  const status = item.status ? statusDetails[item.status] : null;
  const StatusIcon = status?.icon;
  const { main, secondary } = figures(item, variant);
  const details = secondary.filter(Boolean).join(" · ");
  return <li className="min-w-0 border-b border-line py-3 first:pt-1 last:border-b-0 last:pb-1">
    <div className="flex min-w-0 items-start justify-between gap-3">
      <p className="min-w-0 break-words font-semibold leading-snug text-ink">{item.productName}</p>
      {main ? <p className="shrink-0 text-right leading-tight"><span className="figure block text-lg">{main.value}</span><span className="text-xs text-muted">{main.label}</span></p> : null}
    </div>
    {details ? <p className="mt-0.5 text-sm leading-5 text-muted">{details}</p> : null}
    {status && StatusIcon ? <p className={`status mt-1.5 ${status.className}`}><StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />{status.label}</p> : null}
  </li>;
}

export function AiProductPresentation({ presentation }: { presentation: AiProductPresentationData }) {
  const meta = [presentation.periodLabel, presentation.note].filter(Boolean).join(" · ");
  return <AiResult title={presentation.title} icon={Package} meta={meta || undefined}>
    <ul className="min-w-0">
      {presentation.items.map((item, index) => <ProductRow key={`${item.productName}-${index}`} item={item} variant={presentation.variant} />)}
    </ul>
  </AiResult>;
}
