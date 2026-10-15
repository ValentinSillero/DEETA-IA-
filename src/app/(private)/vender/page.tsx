import { FileUp, PackagePlus, Plus } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { SaleComposer } from "@/components/sales/sale-composer";
import { getOpenCashSessionForUser } from "@/data/cash";
import { getBusinessOnboardingStateForUser } from "@/data/onboarding";
import { getSaleProductsForUser } from "@/data/sales";
import { canManageCatalog } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Nueva venta" };

export default async function SellPage() {
  const session = await requireSession();
  const [products, openCash, onboarding] = await Promise.all([
    getSaleProductsForUser(session.user.id),
    getOpenCashSessionForUser(session.user.id),
    getBusinessOnboardingStateForUser(session.user.id),
  ]);
  const header = <div className="mb-6"><h1 className="page-title">Nueva venta</h1><p className="page-lead">Buscá, agregá y cobrá.</p></div>;

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

  return <div>{header}<SaleComposer products={products} hasOpenCash={Boolean(openCash)} /></div>;
}
