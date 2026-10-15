import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AiChat } from "@/components/ai/ai-chat";
import { getLatestAiConversationForUser } from "@/data/ai";
import { getBusinessForUser } from "@/data/businesses";
import { getBusinessOnboardingStateForUser } from "@/data/onboarding";
import { getAiConfiguration } from "@/lib/env";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "DEETA AI" };

export default async function DeetaAiPage() {
  const session = await requireSession();
  const [context, conversation, onboarding] = await Promise.all([
    getBusinessForUser(session.user.id),
    getLatestAiConversationForUser(session.user.id),
    getBusinessOnboardingStateForUser(session.user.id),
  ]);
  if (!context) redirect("/onboarding");
  if (context.role === "EMPLOYEE") redirect("/dashboard");
  const configuration = getAiConfiguration();
  const hasSales = onboarding?.signals.hasSales ?? true;
  const notice = hasSales ? null : <div className="deeta-rule mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5" role="status"><Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" /><div className="min-w-0"><p className="font-black">Todavía necesito información de tu negocio</p><p className="mt-1 text-sm leading-6 text-muted">Cuando registres tus primeras ventas, DEETA AI va a poder ayudarte a analizar tu negocio.</p><Link href={onboarding?.signals.hasStock ? "/vender" : "/productos"} className="mt-3 inline-flex min-h-11 items-center text-sm font-extrabold text-brand underline decoration-2 underline-offset-4">{onboarding?.signals.hasStock ? "Registrar primera venta" : "Cargar productos"}</Link></div></div>;
  return <AiChat notice={notice} enabled={configuration.available} initialConversation={conversation ? { id: conversation.id, messages: conversation.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, presentation: message.presentation })) } : null} />;
}
