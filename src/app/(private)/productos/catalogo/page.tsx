import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CatalogPicker } from "@/components/catalog/catalog-picker";
import { NoAccess } from "@/components/no-access";
import { getCatalogCategories, searchCatalogForUser } from "@/data/catalog";
import { CATALOG_ATTRIBUTION, catalogCategoryPriority } from "@/lib/catalog";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Agregar desde el catálogo" };

export default async function CatalogPage() {
  const session = await requireSession();
  // Primera página renderizada en el servidor: la pantalla abre con resultados,
  // sin esperar otra petición desde el navegador. La consulta misma valida que
  // la persona pueda crear productos en su negocio activo (null = sin permiso).
  const [initial, categories] = await Promise.all([
    searchCatalogForUser(session.user.id, { query: "", category: null, kioskOnly: null, page: 1 }),
    getCatalogCategories(),
  ]);
  if (!initial) return <NoAccess section="agregar productos" />;
  const priority = catalogCategoryPriority(initial.rubro as Parameters<typeof catalogCategoryPriority>[0]);
  const rank = (name: string) => { const index = priority.indexOf(name); return index === -1 ? 999 : index; };
  const ordered = [...categories].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "es"));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/productos" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a productos</Link>
      <h1 className="page-title mt-2">Agregar desde el catálogo</h1>
      <p className="page-lead">Elegí los productos que vendés y poneles precio. Más de 4.000 productos comunes, con su código de barras.</p>
      <CatalogPicker initial={initial} categories={ordered} />
      <p className="mt-8 text-xs leading-5 text-subtle">{CATALOG_ATTRIBUTION}</p>
    </div>
  );
}
