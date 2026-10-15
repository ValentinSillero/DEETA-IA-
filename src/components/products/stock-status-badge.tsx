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
      ? { label: "Sin stock", icon: CircleX, className: "text-red-700" }
      : status === "LOW_STOCK"
        ? { label: "Poco stock", icon: AlertTriangle, className: "text-[#a8530f]" }
        : { label: "Disponible", icon: CheckCircle2, className: "text-success" };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${config.className} ${compact ? "text-xs" : "text-sm"}`}>
      <Icon className={compact ? "size-3.5" : "size-4"} aria-hidden="true" />
      {config.label}
    </span>
  );
}
