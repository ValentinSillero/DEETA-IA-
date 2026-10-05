import type { Metadata } from "next";

import { SaleComposer } from "@/components/sales/sale-composer";
import { getOpenCashSessionForUser } from "@/data/cash";
import { getSaleProductsForUser } from "@/data/sales";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Nueva venta" };

export default async function SellPage() {
  const session = await requireSession();
  const [products, openCash] = await Promise.all([
    getSaleProductsForUser(session.user.id),
    getOpenCashSessionForUser(session.user.id),
  ]);
  return <div><div className="mb-6"><p className="text-sm font-extrabold uppercase tracking-[0.12em] text-mint-600">Venta rápida</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Nueva venta</h1><p className="mt-2 text-muted">Buscá, agregá y cobrá.</p></div><SaleComposer products={products} hasOpenCash={Boolean(openCash)} /></div>;
}
