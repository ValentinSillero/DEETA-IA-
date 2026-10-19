import { ArrowRight, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AiChat, type AiActionLinks } from "@/components/ai/ai-chat";
import { NoAccess } from "@/components/no-access";
import { getLatestAiConversationForUser } from "@/data/ai";
import { getBusinessForUser } from "@/data/businesses";
import { can, getActiveMembership } from "@/data/membership";
import { getBusinessOnboardingStateForUser } from "@/data/onboarding";
import { getAiConfiguration } from "@/lib/env";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "DEETA AI" };

export default async function DeetaAiPage() {
  const session = await requireSession();
  const membership = await getActiveMembership(session.user.id);
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(membership, "AI_USE")) return <NoAccess section="DEETA AI" />;
  const [context, conversation, onboarding] = await Promise.all([
    getBusinessForUser(session.user.id),
    getLatestAiConversationForUser(session.user.id),
    getBusinessOnboardingStateForUser(session.user.id),
  ]);
  if (!context) redirect("/onboarding");
  const configuration = getAiConfiguration();

  // Próximos pasos que el chat puede ofrecer, solo los que el rol puede hacer.
  const actions: AiActionLinks = {};
  if (can(membership, "SALE_CREATE")) actions.SELL = { href: "/vender", label: "Registrar una venta" };
  if (can(membership, "PRODUCT_CREATE")) actions.ADD_PRODUCT = { href: "/productos/nuevo", label: "Agregar producto" };
  if (can(membership, "PRODUCT_VIEW")) actions.PRODUCTS = { href: "/productos", label: "Ver productos" };

  const hasSales = onboarding?.signals.hasSales ?? true;
  const nextStep = onboarding?.signals.hasStock ? actions.SELL : actions.ADD_PRODUCT;
  const notice = hasSales ? null : (
    <div className="notice-info flex items-start gap-3" role="status">
      <Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">Todavía no hay ventas para analizar.</p>
        <p className="text-muted">Cuando registres las primeras, voy a poder ayudarte mucho más.</p>
        {nextStep && <Link href={nextStep.href} className="mt-1 inline-flex min-h-10 items-center gap-1.5 font-semibold text-brand underline-offset-4 hover:underline">{nextStep.label}<ArrowRight className="size-4" aria-hidden="true" /></Link>}
      </div>
    </div>
  );

  return <AiChat
    notice={notice}
    actions={actions}
    enabled={configuration.available}
    initialConversation={conversation ? { id: conversation.id, messages: conversation.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, presentation: message.presentation })) } : null}
  />;
}
