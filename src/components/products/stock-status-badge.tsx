import { AlertTriangle, CheckCircle2, CircleX } from "lucide-react";

import { stockStatus } from "@/lib/inventory";

export function StockStatusBadge({
  currentStock,
  minimumStock,
  compact = false,
}: {
  currentStock: number;
  minimumStock: number;
  compact?: boolean;
}) {
  const status = stockStatus(currentStock, minimumStock);
  const config =
    status === "OUT_OF_STOCK"
      ? { label: "Sin stock", icon: CircleX, className: "bg-red-50 text-red-700" }
      : status === "LOW_STOCK"
        ? { label: "Poco stock", icon: AlertTriangle, className: "bg-orange-100 text-[#b65d16]" }
        : { label: "Disponible", icon: CheckCircle2, className: "bg-accent-soft text-success" };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-extrabold ${config.className} ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}>
      <Icon className={compact ? "size-3.5" : "size-4"} aria-hidden="true" />
      {config.label}
    </span>
  );
}
