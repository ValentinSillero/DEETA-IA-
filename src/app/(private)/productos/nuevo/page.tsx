import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { createProductAction } from "@/actions/products";
import { ProductForm } from "@/components/products/product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ barcode?: string }> }) {
  const { barcode } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/productos" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Volver a productos</Link>
      <p className="mt-7 text-sm font-extrabold text-mint-600">Nuevo</p>
      <h1 className="mt-2 page-title">Crear producto</h1>
      <p className="mt-3 leading-7 text-muted">Cargá lo esencial. Después vas a poder actualizar cantidades con cada movimiento.</p>
      <section className="panel mt-7"><ProductForm action={createProductAction} initialBarcode={barcode?.slice(0, 80)} /></section>
    </div>
  );
}
