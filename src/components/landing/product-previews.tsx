import {
  ArrowRight,
  Banknote,
  Camera,
  CircleCheck,
  CreditCard,
  Plus,
  ReceiptText,
  Search,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { DeetaIcon } from "@/components/ui/logo";

// Vistas livianas que reproducen la interfaz real de DEETA con datos de
// ejemplo. Son componentes de servidor sin JavaScript: no cargan el escáner,
// gráficos ni DEETA AI reales.

function Frame({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className={`min-w-0 overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
      {children}
      <figcaption className="border-t border-line bg-surface-2 px-4 py-2 text-xs text-muted">{label}</figcaption>
    </figure>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="ledger-row">
      <span>{label}</span><span className="ledger-fill" aria-hidden="true" /><span className={strong ? "text-ink" : ""}>{value}</span>
    </div>
  );
}

export function DayPreview() {
  return (
    <Frame label="Vista de ejemplo · Inicio">
      <div className="px-5 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-muted">Ventas de hoy</p>
          <p className="text-sm text-muted">38 ventas</p>
        </div>
        <p className="figure mt-1 text-[2.4rem] leading-none sm:text-[2.75rem]">$ 412.600</p>
        <div className="ledger mt-3 text-sm">
          <Row label="Efectivo" value="$ 188.300" />
          <Row label="Transferencias" value="$ 161.900" />
          <Row label="Tarjetas" value="$ 62.400" />
        </div>
      </div>
      <div className="border-t border-line bg-surface-2/60 px-5 py-4">
        <div className="ledger text-sm">
          <Row label="Margen de lo vendido" value="$ 131.200" />
          <Row label="Gastos" value="−$ 24.500" />
          <div className="ledger-total"><span className="font-semibold">Resultado estimado</span><span className="figure text-xl">$ 106.700</span></div>
        </div>
      </div>
    </Frame>
  );
}

export function SaleFlowPreview() {
  const steps = [
    { icon: Search, title: "Buscá o escaneá", text: "Por nombre o con la cámara del celular." },
    { icon: Plus, title: "Agregá", text: "Cantidades con un toque." },
    { icon: Banknote, title: "Cobrá", text: "Efectivo, transferencia o tarjeta." },
    { icon: CircleCheck, title: "Listo", text: "El stock se descuenta solo." },
  ];
  return (
    <Frame label="Así es una venta en DEETA">
      <ol className="grid gap-px bg-line sm:grid-cols-2">
        {steps.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="flex gap-3 bg-surface p-4">
            <span className="figure grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-sm text-muted">{index + 1}</span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold"><Icon className="size-4 text-brand" aria-hidden="true" />{title}</p>
              <p className="mt-0.5 text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
        {[{ icon: Banknote, label: "Efectivo" }, { icon: ReceiptText, label: "Transferencia" }, { icon: CreditCard, label: "Tarjeta" }, { icon: Camera, label: "Escáner con cámara" }].map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-muted"><Icon className="size-3.5" aria-hidden="true" />{label}</span>
        ))}
      </div>
    </Frame>
  );
}

export function StockPreview() {
  const rows = [
    { name: "Aceite girasol 1,5 L", stock: 3, min: 6, state: "low" },
    { name: "Fideos tirabuzón 500 g", stock: 0, min: 10, state: "out" },
    { name: "Azúcar 1 kg", stock: 24, min: 8, state: "ok" },
    { name: "Lavandina 2 L", stock: 11, min: 5, state: "ok" },
  ] as const;
  const stateLabel = { low: { text: "Poco stock", className: "text-[#a8530f]", icon: TriangleAlert }, out: { text: "Sin stock", className: "text-red-700", icon: TriangleAlert }, ok: { text: "Disponible", className: "text-success", icon: CircleCheck } };
  return (
    <Frame label="Vista de ejemplo · Productos">
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-muted sm:grid-cols-[minmax(0,1fr)_4rem_4rem_7rem]" aria-hidden="true">
        <span>Producto</span><span className="text-right">Stock</span><span className="text-right">Mínimo</span><span className="hidden sm:block">Estado</span>
      </div>
      <ul>
        {rows.map((row) => {
          const state = stateLabel[row.state]; const Icon = state.icon;
          return (
            <li key={row.name} className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-x-3 gap-y-0.5 border-b border-line px-4 py-2.5 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_4rem_4rem_7rem]">
              <span className="min-w-0 truncate font-semibold">{row.name}</span>
              <span className="figure text-right text-base">{row.stock}</span>
              <span className="text-right text-muted tabular-nums">{row.min}</span>
              <span className={`status col-span-3 sm:col-span-1 ${state.className}`}><Icon className="size-3.5" aria-hidden="true" />{state.text}</span>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

export function CashPreview() {
  return (
    <Frame label="Vista de ejemplo · Caja">
      <div className="px-5 py-4">
        <p className="font-display text-lg font-bold">Hoja de caja</p>
        <div className="ledger mt-2 text-sm">
          <Row label="Efectivo inicial" value="$ 20.000" />
          <Row label="Ventas en efectivo" value="+$ 188.300" />
          <Row label="Gastos en efectivo" value="−$ 9.500" />
          <div className="ledger-total"><span className="font-semibold">Debería haber</span><span className="figure text-xl">$ 198.800</span></div>
          <Row label="Contaste" value="$ 198.800" />
          <div className="flex items-center justify-between py-1"><span className="text-muted">Diferencia</span><span className="status text-sm text-success"><CircleCheck className="size-4" aria-hidden="true" /> Coincide</span></div>
        </div>
      </div>
    </Frame>
  );
}

export function AnalysisPreview() {
  const figures = [
    { label: "Ventas", value: "$ 2.840.000", change: "+12% vs. mes anterior", tone: "text-success" },
    { label: "Gastos", value: "$ 690.000", change: "+31% vs. mes anterior", tone: "text-red-700" },
    { label: "Margen bruto", value: "$ 910.000", change: "+6% vs. mes anterior", tone: "text-success" },
    { label: "Resultado estimado", value: "$ 220.000", change: "−18% vs. mes anterior", tone: "text-red-700" },
  ];
  return (
    <Frame label="Vista de ejemplo · Análisis del mes">
      <div className="border-b border-line px-5 py-4">
        <p className="text-sm font-semibold text-muted">En pocas palabras</p>
        <p className="mt-1 font-display text-lg font-medium leading-snug">Vendiste más que el mes pasado, pero tus gastos crecieron todavía más.</p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-line">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-surface px-4 py-3.5">
            <dt className="text-sm text-muted">{figure.label}</dt>
            <dd className="figure mt-0.5 text-lg sm:text-xl">{figure.value}</dd>
            <dd className={`mt-0.5 text-xs font-semibold ${figure.tone}`}>{figure.change}</dd>
          </div>
        ))}
      </dl>
    </Frame>
  );
}

export function AiPreview() {
  return (
    <Frame label="Vista de ejemplo · DEETA AI responde con los datos registrados del negocio">
      <div className="grid gap-5 px-5 py-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted"><UserRound className="size-3.5" aria-hidden="true" /> Tu pregunta</p>
          <p className="mt-1 font-display text-lg font-semibold leading-snug">¿Por qué vendí más pero me quedó menos?</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand"><DeetaIcon className="size-4" /> DEETA</p>
          <p className="mt-1.5 text-[0.95rem] leading-7">Las ventas subieron un 12%, pero los gastos aumentaron un 31%. Los aumentos más grandes están en <strong className="font-semibold">Luz</strong> y <strong className="font-semibold">Mantenimiento</strong>.</p>
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm"><span>Luz</span><span className="font-semibold tabular-nums">$ 86.000 <span className="text-red-700">+48%</span></span></div>
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm"><span>Mantenimiento</span><span className="font-semibold tabular-nums">$ 120.000 <span className="text-red-700">+35%</span></span></div>
            <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span>Transporte</span><span className="font-semibold tabular-nums">$ 64.000 <span className="text-muted">sin cambios</span></span></div>
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">Conviene revisar <ArrowRight className="size-4" aria-hidden="true" /> los gastos de luz y mantenimiento</p>
        </div>
      </div>
    </Frame>
  );
}

export function DevicesPreview() {
  return (
    <div className="flex min-w-0 items-end justify-center gap-3 sm:gap-6" aria-hidden="true">
      <div className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface p-2 sm:max-w-[22rem]">
        <div className="rounded-md border border-line bg-canvas p-4">
          <p className="text-xs font-semibold text-muted">Computadora · Ventas de hoy</p>
          <p className="figure mt-1 text-2xl sm:text-3xl">$ 412.600</p>
          <div className="ledger mt-2 text-xs"><Row label="Efectivo" value="$ 188.300" /><Row label="Transferencias" value="$ 161.900" /></div>
        </div>
        <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-line" />
      </div>
      <div className="w-24 shrink-0 rounded-[1.1rem] border border-line-strong bg-surface p-1.5 min-[400px]:w-32 sm:w-36">
        <div className="rounded-[0.8rem] border border-line bg-canvas px-2.5 pb-5 pt-4">
          <p className="text-[0.65rem] font-semibold text-muted">Celular · Hoy</p>
          <p className="figure mt-1 text-sm min-[400px]:text-lg">$ 412.600</p>
          <div className="mt-3 h-6 rounded-md bg-brand" />
        </div>
      </div>
    </div>
  );
}
