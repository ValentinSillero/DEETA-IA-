import { MessageCircle } from "lucide-react";

import { buildWhatsappLink, getSupportWhatsappNumber, LANDING_SUPPORT_MESSAGE } from "@/lib/support";

// Botón flotante de contacto en la landing. Discreto (no compite con
// "Empezar gratis"), con texto visible y respetando el borde inferior del
// teléfono. Sin número configurado no se muestra.
export function WhatsappFloat() {
  const number = getSupportWhatsappNumber();
  if (!number) return null;
  return (
    <a
      href={buildWhatsappLink(number, LANDING_SUPPORT_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 bg-ink px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(29,24,80,0.22)] transition-colors hover:bg-ink-soft sm:right-6 sm:bottom-6"
    >
      <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
      WhatsApp
      <span className="sr-only">: escribinos (se abre WhatsApp)</span>
    </a>
  );
}
