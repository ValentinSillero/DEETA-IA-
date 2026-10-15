import Link from "next/link";

import { DeetaBrandLogo } from "@/components/ui/logo";

const promises = [
  ["Ventas", "registradas al instante"],
  ["Caja", "cuadrada al cerrar"],
  ["Stock", "al día con cada venta"],
  ["Números", "explicados sin vueltas"],
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="hidden border-r border-line bg-surface px-10 py-10 lg:flex lg:flex-col lg:justify-between">
        <DeetaBrandLogo />
        <div className="max-w-sm">
          <p className="font-display text-[2.1rem] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink">Tu negocio, en orden.</p>
          {/* Lectura de comprobante: el mismo lenguaje visual que la caja de DEETA. */}
          <div className="ledger mt-8">
            {promises.map(([label, value]) => (
              <div key={label} className="ledger-row"><span className="font-semibold text-ink">{label}</span><span className="ledger-fill" aria-hidden="true" /><span className="font-normal text-muted">{value}</span></div>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted">Hecho para comercios de Argentina y Uruguay.</p>
      </div>
      <div className="flex min-h-dvh flex-col bg-canvas">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end">
          <div className="lg:hidden"><DeetaBrandLogo className="w-32" /></div>
          <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-ink">Volver al inicio</Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </main>
  );
}
