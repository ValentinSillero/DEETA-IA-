"use client";

import { Archive, ArrowRight } from "lucide-react";
import Link from "next/link";

import { StockStatusBadge } from "@/components/products/stock-status-badge";
import { formatMoney } from "@/lib/inventory";

export type ProductRow = { id: string; name: string; salePriceCents: number; currentStock: number; minimumStock: number; isActive: boolean };

// Filas de la lista de Productos. Se arman en el navegador a partir de datos
// compactos: con inventarios grandes, mandar el HTML de cada fila desde el
// servidor repetía todas las clases y pesaba ~2 KB por producto.
export function ProductRows({ products }: { products: ProductRow[] }) {
  return <ul>
    {products.map((product) => (
      <li key={product.id} className="border-b border-line last:border-b-0">
        <Link
          href={`/productos/${product.id}`}
          className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5 md:grid-cols-[minmax(0,1fr)_8rem_6rem_9rem_1.25rem]"
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold">{product.name}</span>
            <span className="mt-0.5 block text-sm text-muted md:hidden">{product.salePriceCents > 0 ? formatMoney(product.salePriceCents) : <span className="font-semibold text-[#a8530f]">Sin precio</span>}</span>
          </span>
          <span className="figure hidden text-right text-base md:block">{product.salePriceCents > 0 ? formatMoney(product.salePriceCents) : <span className="font-sans text-sm font-semibold text-[#a8530f]">Sin precio</span>}</span>
          <span className="text-right">
            <span className="figure block text-lg leading-none md:text-base">{product.currentStock}</span>
            <span className="text-xs text-muted md:hidden">en stock</span>
          </span>
          <span className="col-span-2 md:col-span-1">
            {product.isActive ? (
              <StockStatusBadge currentStock={product.currentStock} minimumStock={product.minimumStock} compact />
            ) : (
              <span className="status text-muted"><Archive className="size-3.5" aria-hidden="true" /> Desactivado</span>
            )}
          </span>
          <ArrowRight className="hidden size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink md:block" aria-hidden="true" />
        </Link>
      </li>
    ))}
  </ul>;
}
