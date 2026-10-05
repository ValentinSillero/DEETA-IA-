import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateProductAction } from "@/actions/products";
import { ProductForm } from "@/components/products/product-form";
import { getProductForUser } from "@/data/products";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const record = await getProductForUser(session.user.id, id);
  if (!record) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/productos/${id}`} className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Volver al producto</Link>
      <p className="mt-7 text-sm font-extrabold uppercase tracking-[0.12em] text-mint-600">Producto</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Editar información</h1>
      <p className="mt-3 leading-7 text-muted">Estos cambios no modifican la cantidad ni agregan movimientos.</p>
      <section className="panel mt-7"><ProductForm action={updateProductAction} product={record.product} /></section>
    </div>
  );
}
