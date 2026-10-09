import "server-only";

import { addAiMessageForUser, finishAiUsage, getAiAccessForUser, getOrCreateAiConversation, getRecentAiMessagesForUser, reserveAiUsage } from "@/data/ai";
import { createAiToolExecutor, DEETA_AI_TOOLS } from "@/data/ai-tools";
import { GroqChatCompletionsProvider } from "@/lib/ai/groq-provider";
import { restrictedRequestReply } from "@/lib/ai/guardrails";
import type { AiPresentation } from "@/lib/ai/presentation";
import { clarificationForAiQuestion, planDeetaAiRequest } from "@/lib/ai/planner";
import { AiProviderError, type AiProvider, type AiRateLimitKind } from "@/lib/ai/types";
import { getAiConfiguration } from "@/lib/env";

export type AskDeetaAiResult =
  | { ok: true; conversationId: string; answer: string; presentation?: AiPresentation }
  | { ok: false; reason: "UNAVAILABLE" | "FORBIDDEN" | "INVALID_CONVERSATION" | "RATE_LIMIT" | "MONTHLY_LIMIT" | "PROVIDER_ERROR"; retryAfterSeconds?: number; rateLimitKind?: AiRateLimitKind };

export async function askDeetaAi(
  userId: string,
  input: { question: string; conversationId: string | null },
  providerOverride?: AiProvider,
): Promise<AskDeetaAiResult> {
  const access = await getAiAccessForUser(userId);
  if (!access) return { ok: false, reason: "FORBIDDEN" };
  const conversationId = await getOrCreateAiConversation(userId, input.conversationId, input.question.slice(0, 80));
  if (!conversationId) return { ok: false, reason: "INVALID_CONVERSATION" };
  const restrictedReply = restrictedRequestReply(input.question);
  if (restrictedReply) {
    await addAiMessageForUser(userId, conversationId, "USER", input.question);
    await addAiMessageForUser(userId, conversationId, "ASSISTANT", restrictedReply);
    return { ok: true, conversationId, answer: restrictedReply };
  }
  const clarificationReply = clarificationForAiQuestion(input.question);
  if (clarificationReply) {
    await addAiMessageForUser(userId, conversationId, "USER", input.question);
    await addAiMessageForUser(userId, conversationId, "ASSISTANT", clarificationReply);
    return { ok: true, conversationId, answer: clarificationReply };
  }
  const config = getAiConfiguration();
  const provider = providerOverride ?? (config.available
    ? new GroqChatCompletionsProvider(config.GROQ_API_KEY, config.GROQ_MODEL, config.DEETA_AI_TIMEOUT_MS)
    : null);
  if (!provider) return { ok: false, reason: "UNAVAILABLE" };
  const limits = config.available
    ? { minute: config.DEETA_AI_REQUESTS_PER_MINUTE, monthly: config.DEETA_AI_MONTHLY_LIMIT }
    : { minute: 8, monthly: 100 };
  const reserved = await reserveAiUsage(access, conversationId, provider.name, provider.model, limits.minute, limits.monthly);
  if (!reserved.ok) return { ok: false, reason: reserved.reason };
  await addAiMessageForUser(userId, conversationId, "USER", input.question);
  const messages = await getRecentAiMessagesForUser(userId, conversationId, 6);
  const preparedTool = planDeetaAiRequest(input.question, messages);
  try {
    const response = await provider.respond({ messages, tools: DEETA_AI_TOOLS, executeTool: createAiToolExecutor(userId), preparedTool });
    await addAiMessageForUser(userId, conversationId, "ASSISTANT", response.text, response.presentation);
    await finishAiUsage(reserved.id, { ok: true, toolCalls: response.toolCalls, inputTokens: response.inputTokens, outputTokens: response.outputTokens, totalTokens: response.totalTokens });
    return { ok: true, conversationId, answer: response.text, presentation: response.presentation };
  } catch (error) {
    const errorCode = error instanceof AiProviderError ? error.code : "PROVIDER_ERROR";
    await finishAiUsage(reserved.id, { ok: false, errorCode });
    if (error instanceof AiProviderError && error.code === "RATE_LIMIT") {
      return { ok: false, reason: "RATE_LIMIT", retryAfterSeconds: error.retryAfterSeconds, rateLimitKind: error.rateLimitKind };
    }
    return { ok: false, reason: "PROVIDER_ERROR" };
  }
}
