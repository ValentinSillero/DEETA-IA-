import { ArrowRight, ListChecks } from "lucide-react";
import Link from "next/link";

// Atajo para negocios sin productos: sumar los comunes desde el catálogo.
export function CatalogStartCard({ className = "" }: { className?: string }) {
  return (
    <Link href="/productos/catalogo" className={`group flex items-start gap-3 rounded-2xl border border-mint-200 bg-brand-soft p-4 transition-colors hover:border-brand/40 sm:p-5 ${className}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-brand"><ListChecks className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">Empezá rápido</span>
        <span className="mt-0.5 block text-sm leading-6 text-muted">Elegí tus productos de una lista de más de 4.000 productos comunes, con su código de barras.</span>
        <span className="mt-1.5 inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-brand">Elegir del catálogo<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
      </span>
    </Link>
  );
}
