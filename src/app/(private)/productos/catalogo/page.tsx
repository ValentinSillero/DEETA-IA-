import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CatalogPicker } from "@/components/catalog/catalog-picker";
import { NoAccess } from "@/components/no-access";
import { getBusinessForUser } from "@/data/businesses";
import { can, getActiveMembership } from "@/data/membership";
import { CATALOG_ATTRIBUTION } from "@/lib/catalog";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Agregar desde el catálogo" };

export default async function CatalogPage() {
  const session = await requireSession();
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "PRODUCT_CREATE")) return <NoAccess section="agregar productos" />;
  const context = await getBusinessForUser(session.user.id);
  if (!context) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/productos" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a productos</Link>
      <h1 className="page-title mt-2">Agregar desde el catálogo</h1>
      <p className="page-lead">Elegí los productos que vendés y poneles precio. Más de 4.000 productos comunes, con su código de barras.</p>
      <CatalogPicker defaultKioskOnly={context.business.category === "KIOSK"} />
      <p className="mt-8 text-xs leading-5 text-subtle">{CATALOG_ATTRIBUTION}</p>
    </div>
  );
}
