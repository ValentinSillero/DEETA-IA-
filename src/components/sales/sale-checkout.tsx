"use client";

import { Banknote, CreditCard, LoaderCircle, NotebookPen, ReceiptText, Search, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { quickCreateCustomerAction, searchCustomersAction } from "@/actions/customers";
import type { CustomerListItem } from "@/data/customers";
import type { SalePaymentMethod } from "@/db/schema";
import { formatMoney } from "@/lib/inventory";
import { parseMoneyToCents } from "@/lib/product-validations";
import { salePaymentIssue, summarizeSalePayments, type SalePaymentLine } from "@/lib/sales";

export type CheckoutPayload = {
  payments: SalePaymentLine[];
  receivedCashCents: number | null;
  customerId: string | null;
};

const methods: Array<{ value: SalePaymentMethod; label: string; icon: typeof Banknote }> = [
  { value: "CASH", label: "Efectivo", icon: Banknote },
  { value: "TRANSFER", label: "Transferencia", icon: ReceiptText },
  { value: "CARD", label: "Tarjeta", icon: CreditCard },
  { value: "CREDIT", label: "Fiado", icon: NotebookPen },
];

function cents(value: string) {
  if (!value.trim()) return 0;
  const parsed = parseMoneyToCents(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function amountInput(centsValue: number) {
  return centsValue > 0 ? String(centsValue / 100).replace(".", ",") : "";
}

// Cliente para el fiado: búsqueda con espera corta entre teclas y alta rápida
// sin salir del cobro (el carrito no se pierde).
function CustomerPicker({ selected, onSelect }: { selected: CustomerListItem | null; onSelect: (customer: CustomerListItem | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerListItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string>();
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (selected) return;
    const timeout = window.setTimeout(() => {
      startSearch(async () => setResults(await searchCustomersAction(query)));
    }, query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [query, selected]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-semibold">{selected.name}</p>
          <p className="text-sm text-muted">{selected.balanceCents > 0 ? `Debe ${formatMoney(selected.balanceCents)}` : "Al día"}</p>
        </div>
        <button type="button" onClick={() => onSelect(null)} className="button-quiet min-h-10 shrink-0 px-2 text-sm">Cambiar</button>
      </div>
    );
  }

  function create() {
    setMessage(undefined);
    startSave(async () => {
      const result = await quickCreateCustomerAction({ name, phone });
      if (!result.ok) return setMessage(result.message);
      onSelect(result.customer);
    });
  }

  if (creating) {
    return (
      <div className="grid gap-2 rounded-lg border border-line-strong p-3">
        <p className="text-sm font-semibold">Cliente nuevo</p>
        <label className="field-label text-sm">Nombre<input value={name} onChange={(event) => setName(event.target.value)} className="field-input" autoComplete="off" placeholder="Ej. Juan Pérez" autoFocus /></label>
        <label className="field-label text-sm">Teléfono (opcional)<input value={phone} onChange={(event) => setPhone(event.target.value)} className="field-input" type="tel" inputMode="tel" autoComplete="off" /></label>
        {message && <p className="field-error" role="alert">{message}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setCreating(false)} className="button-secondary min-h-11">Volver</button>
          <button type="button" onClick={create} disabled={saving || name.trim().length < 2} className="button-primary min-h-11">{saving ? "Creando…" : "Crear y elegir"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <label className="relative block">
        <span className="sr-only">Buscar cliente por nombre o teléfono</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-11" placeholder="Buscar cliente…" autoComplete="off" />
        {searching && <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden="true" />}
      </label>
      {results && results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto overscroll-contain rounded-lg border border-line" aria-label="Clientes encontrados">
          {results.map((customer) => (
            <li key={customer.id} className="border-b border-line last:border-b-0">
              <button type="button" onClick={() => onSelect(customer)} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left hover:bg-surface-2">
                <span className="min-w-0 truncate font-semibold">{customer.name}</span>
                <span className="shrink-0 text-sm text-muted">{customer.balanceCents > 0 ? `Debe ${formatMoney(customer.balanceCents)}` : "Al día"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && <p className="text-sm text-muted">{query ? "No encontramos clientes con esa búsqueda." : "Todavía no cargaste clientes."}</p>}
      <button type="button" onClick={() => { setCreating(true); setName(query); }} className="button-quiet min-h-11 justify-start px-2 text-sm"><UserPlus className="size-4" aria-hidden="true" /> Crear cliente</button>
    </div>
  );
}

export function SaleCheckout({
  totalCents,
  hasOpenCash,
  initialCustomer,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  totalCents: number;
  hasOpenCash: boolean;
  initialCustomer: CustomerListItem | null;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (payload: CheckoutPayload) => void;
}) {
  const [split, setSplit] = useState(false);
  const [method, setMethod] = useState<SalePaymentMethod>("CASH");
  const [amounts, setAmounts] = useState<Record<SalePaymentMethod, string>>({ CASH: "", TRANSFER: "", CARD: "", CREDIT: "" });
  const [received, setReceived] = useState("");
  const [customer, setCustomer] = useState<CustomerListItem | null>(initialCustomer);

  const payments: SalePaymentLine[] = split
    ? methods.map(({ value }) => ({ method: value, amountCents: cents(amounts[value]) })).filter((line) => line.amountCents !== 0)
    : [{ method, amountCents: totalCents }];
  const invalidAmount = payments.some((line) => !Number.isFinite(line.amountCents));
  const summary = summarizeSalePayments(invalidAmount ? [] : payments);
  const remainingCents = totalCents - summary.totalCents;
  const receivedCents = received ? parseMoneyToCents(received) : summary.cashCents;
  const changeCents = Number.isFinite(receivedCents) ? receivedCents - summary.cashCents : null;
  const issue = invalidAmount ? "INVALID_AMOUNT" : salePaymentIssue(totalCents, payments, customer?.id ?? null);
  const cashBlocked = summary.cashCents > 0 && !hasOpenCash;
  const changeBlocked = summary.cashCents > 0 && (changeCents === null || changeCents < 0);
  const canConfirm = !pending && !issue && !cashBlocked && !changeBlocked;

  function confirm() {
    if (!canConfirm) return;
    onConfirm({
      payments,
      receivedCashCents: summary.cashCents > 0 ? receivedCents : null,
      customerId: customer?.id ?? null,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-ink/50 p-0 sm:place-items-center sm:p-5" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div className="max-h-[94dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <div className="flex items-start justify-between">
          <div><p className="section-label">Cobrar</p><h2 id="checkout-title" className="figure mt-1 text-[2.25rem] leading-none">{formatMoney(totalCents)}</h2></div>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-xl border border-line" aria-label="Cerrar cobro"><X className="size-5" aria-hidden="true" /></button>
        </div>

        {!split ? (
          <fieldset className="mt-5">
            <legend className="font-semibold">¿Cómo pagó?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
              {methods.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" aria-pressed={method === value} onClick={() => setMethod(value)} className={`min-h-16 rounded-lg border px-2 text-sm font-semibold transition-colors ${method === value ? "border-ink bg-ink text-white" : "border-line-strong hover:bg-surface-2"}`}>
                  <Icon className="mx-auto mb-1.5 size-5" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <fieldset className="mt-5">
            <legend className="font-semibold">Dividir el pago</legend>
            <div className="mt-2 grid gap-2">
              {methods.map(({ value, label, icon: Icon }) => (
                <label key={value} className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-muted" aria-hidden="true" />{label}</span>
                  <input value={amounts[value]} onChange={(event) => setAmounts((current) => ({ ...current, [value]: event.target.value }))} inputMode="decimal" autoComplete="off" className="field-input min-h-11 text-right tabular-nums" placeholder="$ 0" aria-label={`Monto en ${label.toLowerCase()}`} />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
              <p className={remainingCents === 0 ? "font-semibold text-success" : "font-semibold text-[#a8530f]"}>
                {remainingCents === 0 ? "Los montos cubren el total." : remainingCents > 0 ? `Falta asignar ${formatMoney(remainingCents)}` : `Sobran ${formatMoney(-remainingCents)}`}
              </p>
              {remainingCents > 0 && <button type="button" onClick={() => setAmounts((current) => ({ ...current, CREDIT: amountInput(cents(current.CREDIT || "0") + remainingCents) }))} className="button-quiet min-h-10 px-2 text-sm">Dejar el resto fiado</button>}
            </div>
          </fieldset>
        )}
        <button type="button" onClick={() => { setSplit((value) => !value); setAmounts({ CASH: "", TRANSFER: "", CARD: "", CREDIT: "" }); setReceived(""); }} className="button-quiet mt-2 min-h-10 px-2 text-sm">
          {split ? "Cobrar con un solo medio" : "Dividir el pago (por ejemplo, una parte en efectivo y el resto fiado)"}
        </button>

        {summary.cashCents > 0 && (cashBlocked ? (
          <div className="notice-error mt-4">Para cobrar en efectivo primero tenés que abrir la caja. <Link href="/caja" className="underline">Abrir caja</Link></div>
        ) : (
          <div className="mt-4">
            <label className="field-label">Recibí en efectivo{split && <span className="font-normal text-muted"> (a cobrar: {formatMoney(summary.cashCents)})</span>}
              <input value={received} onChange={(event) => setReceived(event.target.value)} inputMode="decimal" autoComplete="off" className="field-input" placeholder={formatMoney(summary.cashCents)} />
            </label>
            {changeCents !== null && changeCents > 0 && <p className="mt-2 rounded-lg bg-accent-soft p-3 font-semibold text-success">Vuelto: {formatMoney(changeCents)}</p>}
            {changeBlocked && <p className="field-error mt-2">El efectivo recibido no alcanza.</p>}
          </div>
        ))}

        {summary.creditCents > 0 && (
          <section className="mt-4 border-t border-line pt-4" aria-label="Cliente del fiado">
            <p className="font-semibold">Fiado: {formatMoney(summary.creditCents)}</p>
            <p className="mb-2 text-sm text-muted">Se suma a la cuenta del cliente. No entra a la caja.</p>
            <CustomerPicker selected={customer} onSelect={setCustomer} />
            {issue === "CUSTOMER_REQUIRED" && <p className="field-error mt-2">Elegí un cliente para registrar la deuda.</p>}
          </section>
        )}

        {error && <p className="notice-error mt-4" role="alert">{error}</p>}
        <button type="button" onClick={confirm} disabled={!canConfirm} className="button-brand mt-5 min-h-14 w-full text-base">{pending ? "Cobrando…" : "Confirmar venta"}</button>
      </div>
    </div>
  );
}
