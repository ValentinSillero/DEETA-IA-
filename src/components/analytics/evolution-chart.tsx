"use client";

import { Check, EyeOff } from "lucide-react";
import { useState, type PointerEvent } from "react";

import { formatMoney } from "@/lib/inventory";

type EvolutionValue = {
  date: string;
  salesCents: number;
  grossMarginCents: number;
  expensesCents: number;
};

type SeriesKey = "salesCents" | "grossMarginCents" | "expensesCents";

const series: Array<{ key: SeriesKey; label: string; explanation: string; color: string; strokeWidth: number }> = [
  { key: "salesCents", label: "Ventas", explanation: "Total vendido en el día.", color: "#5b3df5", strokeWidth: 5 },
  { key: "grossMarginCents", label: "Margen bruto", explanation: "Ventas menos el costo de los productos vendidos.", color: "#168765", strokeWidth: 4 },
  { key: "expensesCents", label: "Gastos", explanation: "Gastos registrados en el día.", color: "#1d1850", strokeWidth: 3 },
];

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00.000Z`));
}

export function EvolutionChart({ values }: { values: EvolutionValue[] }) {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    salesCents: true,
    grossMarginCents: true,
    expensesCents: true,
  });
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, values.length - 1));

  const width = 640;
  const height = 210;
  const horizontalPadding = 22;
  const verticalPadding = 20;
  const activeSeries = series.filter((item) => visible[item.key]);
  const max = Math.max(
    1,
    ...values.flatMap((value) => activeSeries.map((item) => value[item.key])),
  );
  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, values.length - 1));
  const x = (index: number) => values.length === 1
    ? width / 2
    : horizontalPadding + index * ((width - horizontalPadding * 2) / (values.length - 1));
  const y = (value: number) => height - verticalPadding - (Math.max(0, value) / max) * (height - verticalPadding * 2);
  const points = (key: SeriesKey) => values.map((value, index) => `${x(index)},${y(value[key])}`).join(" ");
  const selected = values[safeSelectedIndex];

  if (values.length === 0 || values.every((item) => item.salesCents === 0 && item.grossMarginCents === 0 && item.expensesCents === 0)) {
    return <div className="grid min-h-44 place-items-center rounded-2xl bg-canvas px-5 text-center text-sm leading-6 text-muted">Todavía no hay ventas ni gastos para dibujar la evolución.</div>;
  }

  function toggleSeries(key: SeriesKey) {
    setVisible((current) => {
      const enabled = series.filter((item) => current[item.key]).length;
      if (current[key] && enabled === 1) return current;
      return { ...current, [key]: !current[key] };
    });
  }

  function selectFromPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relative = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setSelectedIndex(Math.round(relative * (values.length - 1)));
  }

  return <div className="min-w-0">
    <div className="flex flex-wrap gap-2" aria-label="Series del gráfico">
      {series.map((item) => <button
        key={item.key}
        type="button"
        aria-pressed={visible[item.key]}
        onClick={() => toggleSeries(item.key)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors ${visible[item.key] ? "border-line bg-surface text-ink" : "border-transparent bg-canvas text-muted"}`}
      >
        <span className="grid size-5 place-items-center rounded-md text-white" style={{ backgroundColor: item.color }} aria-hidden="true">
          {visible[item.key] ? <Check className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </span>
        {item.label}
      </button>)}
    </div>
    <details className="mt-2 max-w-xl">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-black text-muted hover:text-ink">¿Qué significan las líneas?</summary>
      <dl className="grid gap-2 pb-2 text-sm leading-5 text-muted">
        {series.map((item) => <div key={item.key}><dt className="inline font-black text-ink">{item.label}: </dt><dd className="inline">{item.explanation}</dd></div>)}
      </dl>
    </details>

    <div className="mt-4 overflow-hidden rounded-2xl bg-canvas px-1 py-3 sm:px-3">
      <svg
        className="h-auto w-full touch-pan-y"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Evolución diaria de ventas, margen bruto y gastos"
        onPointerMove={selectFromPointer}
        onPointerDown={selectFromPointer}
      >
        {[0.25, 0.5, 0.75, 1].map((step) => <line key={step} x1={horizontalPadding} x2={width - horizontalPadding} y1={y(max * step)} y2={y(max * step)} stroke="#e7e5ef" strokeDasharray="4 7" />)}
        <line x1={horizontalPadding} x2={width - horizontalPadding} y1={height - verticalPadding} y2={height - verticalPadding} stroke="#d9d6e4" />
        {activeSeries.map((item) => <polyline key={item.key} points={points(item.key)} fill="none" stroke={item.color} strokeWidth={item.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />)}
        <line x1={x(safeSelectedIndex)} x2={x(safeSelectedIndex)} y1={verticalPadding} y2={height - verticalPadding} stroke="#858199" strokeWidth="1.5" strokeDasharray="3 5" />
        {activeSeries.map((item) => <circle key={item.key} cx={x(safeSelectedIndex)} cy={y(selected[item.key])} r="6" fill={item.color} stroke="white" strokeWidth="3" />)}
      </svg>
      {values.length > 1 && <label className="sr-only" htmlFor="analysis-day">Día mostrado en el detalle del gráfico</label>}
      {values.length > 1 && <input
        id="analysis-day"
        type="range"
        min={0}
        max={values.length - 1}
        value={safeSelectedIndex}
        onChange={(event) => setSelectedIndex(Number(event.target.value))}
        className="mt-1 w-full accent-[#5b3df5]"
        aria-valuetext={shortDate(selected.date)}
      />}
    </div>

    <section className="mt-3 overflow-hidden rounded-2xl border border-line" aria-live="polite" aria-label={`Detalle del ${shortDate(selected.date)}`}>
      <p className="bg-canvas px-4 py-2 text-sm font-black">{shortDate(selected.date)}</p>
      <dl className="grid gap-px bg-line sm:grid-cols-3">
        {series.map((item) => <div key={item.key} className={`min-w-0 bg-surface p-3 ${visible[item.key] ? "" : "opacity-55"}`}>
          <dt className="flex items-center gap-2 text-xs font-bold text-muted"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.label}</dt>
          <dd className="mt-1 break-words text-base font-black">{formatMoney(selected[item.key])}</dd>
          <dd className="mt-1 text-xs leading-5 text-muted">{item.explanation}</dd>
        </div>)}
      </dl>
    </section>
  </div>;
}
