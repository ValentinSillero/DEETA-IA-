import { CircleCheck, CircleMinus, CirclePlus } from "lucide-react";

import { formatMoney } from "@/lib/inventory";

type CashFigures = {
  openingAmountCents: number;
  cashSalesCents: number;
  cashExpensesCents: number;
  cashCustomerPaymentsCents?: number;
  expectedCashCents: number;
  declaredCashCents: number | null;
  differenceCents: number | null;
};

// Diferencia explicada con texto e ícono, no solo con color.
export function CashDifference({ cents }: { cents: number }) {
  if (cents === 0) return <span className="status text-sm text-success"><CircleCheck className="size-4" aria-hidden="true" /> Coincide</span>;
  if (cents < 0) return <span className="status text-sm text-red-700"><CircleMinus className="size-4" aria-hidden="true" /> Faltan {formatMoney(Math.abs(cents))}</span>;
  return <span className="status text-sm text-[#a8530f]"><CirclePlus className="size-4" aria-hidden="true" /> Sobran {formatMoney(cents)}</span>;
}

// Hoja de caja: cuánto debería haber, cuánto se contó y la diferencia.
export function CashStatement({ cash, size = "default" }: { cash: CashFigures; size?: "default" | "large" }) {
  return (
    <div className="ledger">
      <div className="ledger-row"><span>Efectivo inicial</span><span className="ledger-fill" aria-hidden="true" /><span>{formatMoney(cash.openingAmountCents)}</span></div>
      <div className="ledger-row"><span>Ventas en efectivo</span><span className="ledger-fill" aria-hidden="true" /><span>+{formatMoney(cash.cashSalesCents)}</span></div>
      {(cash.cashCustomerPaymentsCents ?? 0) > 0 && (
        <div className="ledger-row"><span>Cobros de fiado en efectivo</span><span className="ledger-fill" aria-hidden="true" /><span>+{formatMoney(cash.cashCustomerPaymentsCents ?? 0)}</span></div>
      )}
      <div className="ledger-row"><span>Gastos en efectivo</span><span className="ledger-fill" aria-hidden="true" /><span>−{formatMoney(cash.cashExpensesCents)}</span></div>
      <div className="ledger-total">
        <span className="font-semibold">Debería haber</span>
        <span className={`figure leading-none ${size === "large" ? "text-[2rem]" : "text-2xl"}`}>{formatMoney(cash.expectedCashCents)}</span>
      </div>
      {cash.declaredCashCents !== null && (
        <>
          <div className="ledger-row mt-2"><span>Contaste</span><span className="ledger-fill" aria-hidden="true" /><span>{formatMoney(cash.declaredCashCents)}</span></div>
          <div className="flex items-center justify-between gap-3 py-1"><span className="text-muted">Diferencia</span><CashDifference cents={cash.differenceCents ?? 0} /></div>
        </>
      )}
    </div>
  );
}
