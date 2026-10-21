import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { XProfileLink } from "@/components/support/x-profile-link";
import { BetaTag, DeetaBrandLogo } from "@/components/ui/logo";
import { getXProfile } from "@/lib/social";

// Marco simple y legible para Términos y Privacidad: páginas públicas, sin sesión.
export function LegalDocument({ title, updatedAt, children }: { title: string; updatedAt: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <span className="flex items-center gap-2"><DeetaBrandLogo href="/" className="w-28" /><BetaTag /></span>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />Volver al inicio</Link>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <h1 className="page-title">{title}</h1>
        <p className="mt-2 text-sm text-muted">Última actualización: {updatedAt}</p>
        <div className="legal mt-8">{children}</div>
        {getXProfile() && (
          <section className="mt-10 rounded-2xl border border-line bg-surface p-5" aria-labelledby="canales-contacto">
            <h2 id="canales-contacto" className="text-base font-bold">Contacto</h2>
            <p className="mt-1 text-sm text-muted">Para consultas, pedidos de baja o temas de privacidad, escribinos por X (Twitter).</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <li><XProfileLink className="min-h-11 font-semibold text-ink" /></li>
            </ul>
          </section>
        )}
        <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm" aria-label="Documentos legales">
          <Link href="/terminos" className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline">Términos</Link>
          <Link href="/privacidad" className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline">Privacidad</Link>
          <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline">Inicio</Link>
        </nav>
      </main>
    </div>
  );
}

