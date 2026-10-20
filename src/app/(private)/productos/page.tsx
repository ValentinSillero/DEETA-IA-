import { Archive, Camera, FileUp, ListChecks, PackagePlus, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CatalogStartCard } from "@/components/catalog/catalog-start-card";
import { EmptyState } from "@/components/empty-state";
import { ProductSearch } from "@/components/products/product-search";
import { ProductRows } from "@/components/products/product-rows";
import {
  getProductsPageForUser,
  PRODUCTS_PAGE_LIMIT,
  type ProductFilter,
} from "@/data/products";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Productos" };

const filterLabels: Record<ProductFilter, string> = {
  active: "Activos",
  low: "Poco stock",
  out: "Sin stock",
  noprice: "Sin precio",
  inactive: "Desactivados",
};

function isProductFilter(value: string | undefined): value is ProductFilter {
  return value === "active" || value === "low" || value === "out" || value === "inactive" || value === "noprice";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ buscar?: string; estado?: string }>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "PRODUCT_VIEW")) return <NoAccess section="Productos" />;
  const membership = await getActiveMembership(session.user.id);
  const search = params.buscar?.slice(0, 100) ?? "";
  const filter = isProductFilter(params.estado) ? params.estado : "active";
  const pageData = await getProductsPageForUser(session.user.id, { search, filter });
  if (!pageData) redirect("/onboarding");
  const { products, counts } = pageData;
  const trulyEmpty = counts.active === 0 && counts.inactive === 0 && filter === "active" && !search;

  const filterCounts: Partial<Record<ProductFilter, number>> = { active: counts.active, low: counts.low, out: counts.out, inactive: counts.inactive, noprice: counts.noprice };
  // Total del filtro actual, para avisar cuando la lista muestra solo una parte.
  const filterTotal = search ? null : filterCounts[filter] ?? null;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-lead">Precios, stock y estado de tu mercadería.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 empty:hidden sm:flex sm:flex-wrap">
          {can(membership, "PRODUCT_CREATE") && <Link href="/productos/nuevo" className="button-primary px-3"><Plus className="size-5" aria-hidden="true" /> <span className="sm:hidden">Nuevo</span><span className="hidden sm:inline">Nuevo producto</span></Link>}
          {can(membership, "PRODUCT_CREATE") && <Link href="/productos/catalogo" className="button-secondary px-3"><ListChecks className="size-5" aria-hidden="true" /> Catálogo</Link>}
          {can(membership, "STOCK_ADJUST") && <Link href="/productos/ingresar" className={`button-secondary px-3 ${can(membership, "PRODUCT_IMPORT") ? "" : "col-span-2"}`}><Camera className="size-5" aria-hidden="true" /> <span className="sm:hidden">Cámara</span><span className="hidden sm:inline">Ingresar con cámara</span></Link>}
          {can(membership, "PRODUCT_IMPORT") && <Link href="/productos/importar" className="button-secondary px-3"><FileUp className="size-5" aria-hidden="true" /> Importar</Link>}
        </div>
      </div>

      {!trulyEmpty && (
        <div className="mt-6 grid gap-3">
          <ProductSearch initialValue={search} />
          <nav className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Filtrar productos">
            {(Object.keys(filterLabels) as ProductFilter[]).filter((value) => value !== "noprice" || counts.noprice > 0 || filter === "noprice").map((value) => (
              <Link
                key={value}
                href={value === "active" ? "/productos" : `/productos?estado=${value}`}
                className="chip"
                aria-current={filter === value ? "page" : undefined}
              >
                {filterLabels[value]}
                <span className={`tabular-nums ${filter === value ? "text-white/75" : value === "out" && counts.out > 0 ? "text-red-700" : value === "low" && counts.low > 0 ? "text-orange-500" : "text-subtle"}`}>{filterCounts[value]}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}

      {trulyEmpty && can(membership, "PRODUCT_CREATE") && <CatalogStartCard className="mt-6" />}
      {trulyEmpty ? (
        <EmptyState
          icon={PackagePlus}
          title="Todavía no cargaste productos"
          description="Agregá tus productos para empezar a vender y controlar stock."
          actions={can(membership, "PRODUCT_CREATE") ? [{ label: "Agregar producto", href: "/productos/nuevo", icon: Plus }, { label: "Importar productos", href: "/productos/importar", icon: FileUp, variant: "secondary" }] : []}
          note={can(membership, "PRODUCT_CREATE") ? "¿Tenés tus productos en Excel? Podés cargarlos todos juntos." : "Pedile a quien administra el negocio que cargue los productos."}
        />
      ) : products.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          {filter === "inactive" ? <Archive className="mx-auto size-7 text-muted" aria-hidden="true" /> : <SearchX className="mx-auto size-7 text-muted" aria-hidden="true" />}
          <h2 className="mt-3 text-lg font-bold">No encontramos productos</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {search ? "Probá con otro nombre o código." : `No hay productos en “${filterLabels[filter]}”.`}
          </p>
        </section>
      ) : (
        <section className="list-surface mt-4" aria-label="Lista de productos">
          {/* Encabezado de columnas solo en pantallas anchas. */}
          <div className="hidden grid-cols-[minmax(0,1fr)_8rem_6rem_9rem_1.25rem] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-xs font-semibold text-muted md:grid" aria-hidden="true">
            <span>Producto</span><span className="text-right">Precio</span><span className="text-right">Stock</span><span>Estado</span><span />
          </div>
          <ProductRows products={products} />
          {products.length >= PRODUCTS_PAGE_LIMIT && (
            <p className="border-t border-line bg-surface-2 px-4 py-3 text-sm text-muted sm:px-5">
              {filterTotal ? `Mostrando ${products.length} de ${filterTotal.toLocaleString("es-AR")}. ` : `Mostrando los primeros ${products.length}. `}
              Buscá por nombre o código para encontrar el resto.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
