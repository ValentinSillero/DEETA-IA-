import { MessageCircle } from "lucide-react";

import { buildWhatsappLink, getSupportWhatsappNumber, LANDING_SUPPORT_MESSAGE } from "@/lib/support";

// Contacto discreto de la landing: soporte, no CTA comercial. Sin número, no se muestra.
export function LandingSupportLink({ children, className = "", icon = true }: { children: React.ReactNode; className?: string; icon?: boolean }) {
  const number = getSupportWhatsappNumber();
  if (!number) return null;
  return (
    <a href={buildWhatsappLink(number, LANDING_SUPPORT_MESSAGE)} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline ${className}`}>
      {icon ? <MessageCircle className="size-4 shrink-0" aria-hidden="true" /> : null}
      {children}
      <span className="sr-only">(se abre WhatsApp)</span>
    </a>
  );
}
