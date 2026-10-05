import "server-only";

import { addAiMessageForUser, finishAiUsage, getAiAccessForUser, getOrCreateAiConversation, getRecentAiMessagesForUser, reserveAiUsage } from "@/data/ai";
import { createAiToolExecutor, DEETA_AI_TOOLS } from "@/data/ai-tools";
import { OpenAiResponsesProvider } from "@/lib/ai/openai-provider";
import type { AiProvider } from "@/lib/ai/types";
import { getAiConfiguration } from "@/lib/env";

export type AskDeetaAiResult =
  | { ok: true; conversationId: string; answer: string }
  | { ok: false; reason: "UNAVAILABLE" | "FORBIDDEN" | "INVALID_CONVERSATION" | "RATE_LIMIT" | "MONTHLY_LIMIT" | "PROVIDER_ERROR" };

export async function askDeetaAi(
  userId: string,
  input: { question: string; conversationId: string | null },
  providerOverride?: AiProvider,
): Promise<AskDeetaAiResult> {
  const config = getAiConfiguration();
  const provider = providerOverride ?? (config.available ? new OpenAiResponsesProvider(config.OPENAI_API_KEY, config.OPENAI_MODEL, config.DEETA_AI_TIMEOUT_MS) : null);
  if (!provider) return { ok: false, reason: "UNAVAILABLE" };
  const access = await getAiAccessForUser(userId);
  if (!access) return { ok: false, reason: "FORBIDDEN" };
  const conversationId = await getOrCreateAiConversation(userId, input.conversationId, input.question.slice(0, 80));
  if (!conversationId) return { ok: false, reason: "INVALID_CONVERSATION" };
  const limits = config.available
    ? { minute: config.DEETA_AI_REQUESTS_PER_MINUTE, monthly: config.DEETA_AI_MONTHLY_LIMIT }
    : { minute: 8, monthly: 100 };
  const reserved = await reserveAiUsage(access, conversationId, provider.name, provider.model, limits.minute, limits.monthly);
  if (!reserved.ok) return { ok: false, reason: reserved.reason };
  await addAiMessageForUser(userId, conversationId, "USER", input.question);
  const messages = await getRecentAiMessagesForUser(userId, conversationId, 10);
  try {
    const response = await provider.respond({ messages, tools: DEETA_AI_TOOLS, executeTool: createAiToolExecutor(userId) });
    await addAiMessageForUser(userId, conversationId, "ASSISTANT", response.text);
    await finishAiUsage(reserved.id, { ok: true, toolCalls: response.toolCalls, inputTokens: response.inputTokens, outputTokens: response.outputTokens, totalTokens: response.totalTokens });
    return { ok: true, conversationId, answer: response.text };
  } catch (error) {
    await finishAiUsage(reserved.id, { ok: false, errorCode: error instanceof Error ? error.name.slice(0, 80) : "UNKNOWN" });
    return { ok: false, reason: "PROVIDER_ERROR" };
  }
}
