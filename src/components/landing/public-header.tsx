"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { landingLinks } from "@/components/landing/links";
import { DeetaBrandLogo } from "@/components/ui/logo";


// Único componente cliente de la landing: solo abre y cierra el menú móvil.
export function PublicHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1160px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <DeetaBrandLogo href="/" className="w-28 sm:w-32" />
        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Secciones">
          {landingLinks.map((link) => (
            <a key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink">{link.label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/iniciar-sesion" className="button-quiet min-h-10 px-3 text-sm">Ingresar</Link>
          <Link href="/crear-cuenta" className="button-brand hidden min-h-10 px-4 text-sm sm:inline-flex">Empezar gratis</Link>
          <button type="button" onClick={() => setOpen((value) => !value)} className="grid size-10 place-items-center rounded-lg border border-line text-ink lg:hidden" aria-expanded={open} aria-controls="landing-menu" aria-label={open ? "Cerrar menú" : "Abrir menú"}>
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="landing-menu" className="border-t border-line bg-surface px-4 pb-4 pt-2 lg:hidden" aria-label="Secciones">
          <ul className="grid">
            {landingLinks.map((link) => (
              <li key={link.href}><a href={link.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-lg px-2 text-base font-semibold hover:bg-surface-2">{link.label}</a></li>
            ))}
          </ul>
          <Link href="/crear-cuenta" className="button-brand mt-2 w-full">Empezar gratis</Link>
        </nav>
      )}
    </header>
  );
}
