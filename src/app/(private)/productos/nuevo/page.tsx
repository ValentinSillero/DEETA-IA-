import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { createProductAction } from "@/actions/products";
import { CatalogQuickAdd } from "@/components/catalog/catalog-quick-add";
import { NoAccess } from "@/components/no-access";
import { ProductForm } from "@/components/products/product-form";
import { catalogSuggestionForUser } from "@/data/catalog";
import { can, getActiveMembership } from "@/data/membership";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ barcode?: string; completo?: string }> }) {
  const [session, { barcode, completo }] = await Promise.all([requireSession(), searchParams]);
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "PRODUCT_CREATE")) return <NoAccess section="crear productos" />;
  const code = barcode?.trim().slice(0, 80);
  // Si el código está en el catálogo sugerido, alcanza con poner el precio.
  const suggestion = code && completo !== "1" ? await catalogSuggestionForUser(session.user.id, code) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/productos" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Volver a productos</Link>
      <p className="mt-7 text-sm font-extrabold text-mint-600">Nuevo</p>
      <h1 className="mt-2 page-title">Crear producto</h1>
      {suggestion ? (
        <>
          <div className="mt-6"><CatalogQuickAdd suggestion={suggestion} /></div>
          <Link href={`/productos/nuevo?barcode=${encodeURIComponent(suggestion.barcode)}&completo=1`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">Prefiero cargarlo con todos los datos</Link>
        </>
      ) : (
        <>
          <p className="mt-3 leading-7 text-muted">Cargá lo esencial. Después vas a poder actualizar cantidades con cada movimiento.</p>
          <section className="panel mt-7"><ProductForm action={createProductAction} initialBarcode={code} /></section>
        </>
      )}
    </div>
  );
}
