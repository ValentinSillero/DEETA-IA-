import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AiChat } from "@/components/ai/ai-chat";
import { getLatestAiConversationForUser } from "@/data/ai";
import { getBusinessForUser } from "@/data/businesses";
import { getAiConfiguration } from "@/lib/env";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "DEETA AI" };

export default async function DeetaAiPage() {
  const session = await requireSession();
  const context = await getBusinessForUser(session.user.id);
  if (!context) redirect("/onboarding");
  if (context.role === "EMPLOYEE") redirect("/dashboard");
  const [conversation, configuration] = await Promise.all([getLatestAiConversationForUser(session.user.id), Promise.resolve(getAiConfiguration())]);
  return <AiChat enabled={configuration.available} initialConversation={conversation ? { id: conversation.id, messages: conversation.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, presentation: message.presentation })) } : null} />;
}
