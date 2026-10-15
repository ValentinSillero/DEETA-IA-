import { Archive, ArrowRight, Camera, FileUp, PackagePlus, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductSearch } from "@/components/products/product-search";
import { StockStatusBadge } from "@/components/products/stock-status-badge";
import {
  getProductsPageForUser,
  type ProductFilter,
} from "@/data/products";
import { formatMoney } from "@/lib/inventory";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Productos" };

const filterLabels: Record<ProductFilter, string> = {
  active: "Activos",
  low: "Poco stock",
  out: "Sin stock",
  inactive: "Desactivados",
};

function isProductFilter(value: string | undefined): value is ProductFilter {
  return value === "active" || value === "low" || value === "out" || value === "inactive";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ buscar?: string; estado?: string }>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const search = params.buscar?.slice(0, 100) ?? "";
  const filter = isProductFilter(params.estado) ? params.estado : "active";
  const pageData = await getProductsPageForUser(session.user.id, { search, filter });
  if (!pageData) redirect("/onboarding");
  const { products, counts, role } = pageData;
  const trulyEmpty = counts.active === 0 && counts.inactive === 0 && filter === "active" && !search;

  return (
    <div>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="section-label">Mercadería</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Productos</h1>
          <p className="mt-2 text-muted">Todo lo que tenés disponible, en un solo lugar.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:flex"><Link href="/productos/ingresar" className="button-secondary shrink-0 sm:col-span-2 xl:col-span-1"><Camera className="size-5" aria-hidden="true" /> Ingresar con cámara</Link>{role !== "EMPLOYEE" && <><Link href="/productos/importar" className="button-secondary shrink-0"><FileUp className="size-5" aria-hidden="true" /> Importar productos</Link><Link href="/productos/nuevo" className="button-primary shrink-0"><Plus className="size-5" aria-hidden="true" /> Nuevo producto</Link></>}</div>
      </div>

      {!trulyEmpty && (
        <>
          <section className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            <Link href="/productos" className="bg-surface p-3 transition-colors hover:bg-mint-50 sm:p-5">
              <p className="text-2xl font-black sm:text-3xl">{counts.active}</p>
              <p className="mt-1 text-xs font-bold text-muted sm:text-sm">Activos</p>
            </Link>
            <Link href="/productos?estado=low" className="bg-surface p-3 transition-colors hover:bg-orange-100 sm:p-5">
              <p className="text-2xl font-black text-[#b65d16] sm:text-3xl">{counts.low}</p>
              <p className="mt-1 text-xs font-bold text-muted sm:text-sm">Poco stock</p>
            </Link>
            <Link href="/productos?estado=out" className="bg-surface p-3 transition-colors hover:bg-red-50 sm:p-5">
              <p className="text-2xl font-black text-red-700 sm:text-3xl">{counts.out}</p>
              <p className="mt-1 text-xs font-bold text-muted sm:text-sm">Sin stock</p>
            </Link>
          </section>

          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <ProductSearch initialValue={search} />
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar productos">
              {(Object.keys(filterLabels) as ProductFilter[]).map((value) => (
                <Link
                  key={value}
                  href={value === "active" ? "/productos" : `/productos?estado=${value}`}
                  className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-extrabold ${filter === value ? "bg-ink text-white" : "border border-line bg-surface text-muted"}`}
                >
                  {filterLabels[value]}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {trulyEmpty ? (
        <section className="deeta-rule mt-8 rounded-2xl border border-line bg-surface px-5 py-12 text-center sm:px-8 sm:py-16">
          <span className="icon-box mx-auto size-14"><PackagePlus className="size-7" aria-hidden="true" /></span>
          <h2 className="mt-5 text-2xl font-black tracking-tight">Todavía no cargaste productos</h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-muted">Agregá tus productos para empezar a vender y controlar stock.</p>
          {role !== "EMPLOYEE" ? <><div className="mx-auto mt-7 grid max-w-md gap-2 sm:grid-cols-2"><Link href="/productos/nuevo" className="button-primary"><Plus className="size-5" aria-hidden="true" /> Agregar producto</Link><Link href="/productos/importar" className="button-secondary"><FileUp className="size-5" aria-hidden="true" /> Importar productos</Link></div><p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted">¿Tenés tus productos en Excel? Podés cargarlos todos juntos.</p></> : <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted">Pedile a quien administra el negocio que cargue los productos.</p>}
        </section>
      ) : products.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          {filter === "inactive" ? <Archive className="mx-auto size-8 text-muted" /> : <SearchX className="mx-auto size-8 text-muted" />}
          <h2 className="mt-4 text-xl font-black">No encontramos productos</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {search ? "Probá con otro nombre o código." : `No hay productos en “${filterLabels[filter]}”.`}
          </p>
        </section>
      ) : (
        <section className="list-surface mt-6">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/productos/${product.id}`}
              className="group flex min-w-0 items-center gap-4 border-b border-line p-4 transition-colors last:border-b-0 hover:bg-mint-50 sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-black tracking-tight">{product.name}</h2>
                  <p className="mt-1 text-sm font-black text-mint-600 sm:text-base">{formatMoney(product.salePriceCents)}</p>
                </div>
                <div className="shrink-0 text-right"><p className="text-xs font-bold text-muted">Disponible</p><p className="mt-0.5 text-2xl font-black">{product.currentStock}</p></div>
                </div>
                <div className="mt-3">
                {product.isActive ? (
                  <StockStatusBadge currentStock={product.currentStock} minimumStock={product.minimumStock} compact />
                ) : (
                  <span className="rounded-full bg-[#f3f2f8] px-2.5 py-1 text-xs font-extrabold text-muted">Desactivado</span>
                )}
                </div>
              </div>
              <ArrowRight className="size-5 shrink-0 text-[#8c8fa5] transition-transform group-hover:translate-x-1 group-hover:text-ink" aria-hidden="true" />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
