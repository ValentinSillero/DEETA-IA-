import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCashSessionForUser } from "@/data/cash";
import { formatMoney } from "@/lib/inventory";
import { requireSession } from "@/lib/session";

export default async function CashDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params; const cash = await getCashSessionForUser(session.user.id, id); if (!cash) notFound();
  const date = (value: Date) => new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: cash.timezone }).format(value);
  return <div className="mx-auto max-w-3xl"><Link href="/caja" className="inline-flex items-center gap-2 text-sm font-bold text-muted"><ArrowLeft className="size-4" /> Volver a cajas</Link><div className="mt-6"><p className="text-sm font-extrabold uppercase tracking-[0.12em] text-orange-500">Detalle</p><h1 className="mt-2 text-3xl font-black">Caja {cash.status === "OPEN" ? "abierta" : "cerrada"}</h1><p className="mt-2 text-muted">Abierta {date(cash.openedAt)} por {cash.openedByName}</p></div><section className="panel mt-6 grid grid-cols-2 gap-5"><div><p className="text-sm text-muted">Caja inicial</p><p className="mt-1 text-xl font-black">{formatMoney(cash.openingAmountCents)}</p></div><div><p className="text-sm text-muted">Ventas efectivo</p><p className="mt-1 text-xl font-black">{formatMoney(cash.cashSalesCents)}</p></div><div><p className="text-sm text-muted">Gastos efectivo</p><p className="mt-1 text-xl font-black">-{formatMoney(cash.cashExpensesCents)}</p></div><div className="col-span-2 border-t border-line pt-5"><p className="text-sm text-muted">Caja esperada</p><p className="mt-1 text-3xl font-black">{formatMoney(cash.expectedCashCents)}</p></div>{cash.declaredCashCents !== null && <><div><p className="text-sm text-muted">Efectivo contado</p><p className="mt-1 text-xl font-black">{formatMoney(cash.declaredCashCents)}</p></div><div><p className="text-sm text-muted">Diferencia</p><p className={`mt-1 text-xl font-black ${cash.differenceCents === 0 ? "text-success" : "text-red-700"}`}>{formatMoney(cash.differenceCents ?? 0)}</p></div></>}</section>{cash.closedAt && <p className="mt-4 text-sm text-muted">Cerrada {date(cash.closedAt)}{cash.closedByName ? ` por ${cash.closedByName}` : ""}.</p>}</div>;
}
