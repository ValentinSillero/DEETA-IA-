import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductImportUpload } from "@/components/products/import-upload";
import { getBusinessForUser } from "@/data/businesses";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Importar productos" };

export default async function ImportProductsPage() {
  const session = await requireSession();
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "PRODUCT_IMPORT")) return <NoAccess section="la importación de productos" />;
  const context = await getBusinessForUser(session.user.id);
  if (!context) redirect("/onboarding");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/productos" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a productos</Link>
      
      <h1 className="page-title">Importar productos</h1>
      <p className="mt-3 max-w-2xl text-pretty leading-7 text-muted">Si ya tenés tus productos en Excel o CSV, podés cargarlos todos juntos. Nada se importa hasta que revises y confirmes.</p>
      <ProductImportUpload />
    </div>
  );
}
