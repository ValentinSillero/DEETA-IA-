import Link from "next/link";

import { DeetaBrandLogo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative hidden overflow-hidden border-r border-line bg-[#f3f2f8] p-10 text-ink lg:flex lg:flex-col lg:justify-between">
        <DeetaBrandLogo />
        <div className="relative max-w-md">
          <p className="section-label">Gestión sin vueltas</p>
          <p className="mt-5 text-5xl font-black leading-[1.02] tracking-[-0.055em]">
            Tu negocio merece sentirse simple.
          </p>
          <p className="mt-6 text-lg leading-8 text-muted">
            Una base clara para trabajar mejor, estés donde estés.
          </p>
        </div>
        <p className="text-sm font-semibold text-muted">DEETA · Gestión sin vueltas</p>
      </div>
      <div className="flex min-h-dvh flex-col bg-canvas">
        <header className="flex items-center justify-between px-5 py-6 sm:px-8 lg:justify-end">
          <div className="lg:hidden"><DeetaBrandLogo className="w-36" /></div>
          <Link href="/" className="text-sm font-bold text-muted hover:text-ink">Volver al inicio</Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-[460px]">{children}</div>
        </div>
      </div>
    </main>
  );
}
