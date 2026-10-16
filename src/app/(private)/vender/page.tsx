import { FileUp, PackagePlus, Plus } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { SaleComposer } from "@/components/sales/sale-composer";
import { getOpenCashSessionForUser } from "@/data/cash";
import { getActiveCustomerForSaleForUser } from "@/data/customers";
import { getBusinessOnboardingStateForUser } from "@/data/onboarding";
import { getSaleProductsForUser } from "@/data/sales";
import { canManageCatalog } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Nueva venta" };

export default async function SellPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  // El cliente se valida contra el negocio de la sesión; un id ajeno se ignora.
  const customerId = params.cliente && /^[0-9a-f-]{36}$/i.test(params.cliente) ? params.cliente : null;
  const [products, openCash, onboarding, initialCustomer] = await Promise.all([
    getSaleProductsForUser(session.user.id),
    getOpenCashSessionForUser(session.user.id),
    getBusinessOnboardingStateForUser(session.user.id),
    customerId ? getActiveCustomerForSaleForUser(session.user.id, customerId) : Promise.resolve(null),
  ]);
  const header = <div className="mb-6"><h1 className="page-title">Nueva venta</h1><p className="page-lead">{initialCustomer ? `Venta para ${initialCustomer.name}. Podés cobrarla o dejarla fiada.` : "Buscá, agregá y cobrá."}</p></div>;

  if (products.length === 0 && onboarding) {
    const manage = canManageCatalog(onboarding.role);
    const noProducts = !onboarding.signals.hasProducts;
    return <div>{header}{noProducts ? (
      <EmptyState
        className=""
        icon={PackagePlus}
        title="Primero cargá tus productos"
        description="Necesitás cargar al menos un producto antes de registrar una venta."
        actions={manage ? [{ label: "Agregar producto", href: "/productos/nuevo", icon: Plus }, { label: "Importar productos", href: "/productos/importar", icon: FileUp, variant: "secondary" }] : []}
        note={manage ? undefined : "Pedile a quien administra el negocio que cargue los productos."}
      />
    ) : (
      <EmptyState
        className=""
        icon={PackagePlus}
        title="No hay productos con stock"
        description="Para vender, al menos un producto activo tiene que tener unidades disponibles."
        actions={manage ? [{ label: "Cargar stock", href: "/productos?estado=out" }] : []}
        note={manage ? undefined : "Pedile a quien administra el negocio que cargue el stock."}
      />
    )}</div>;
  }

  return <div>{header}<SaleComposer products={products} hasOpenCash={Boolean(openCash)} initialCustomer={initialCustomer} /></div>;
}
