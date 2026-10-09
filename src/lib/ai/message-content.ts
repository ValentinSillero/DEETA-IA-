import { isAiPresentation, type AiPresentation } from "@/lib/ai/presentation";

const STRUCTURED_MESSAGE_PREFIX = "DEETA_AI_MESSAGE_V1:";

export function encodeAiMessageContent(content: string, presentation?: AiPresentation) {
  if (!presentation) return content;
  return STRUCTURED_MESSAGE_PREFIX + JSON.stringify({ content, presentation });
}

export function decodeAiMessageContent(storedContent: string): { content: string; presentation?: AiPresentation } {
  if (!storedContent.startsWith(STRUCTURED_MESSAGE_PREFIX)) return { content: storedContent };
  try {
    const decoded = JSON.parse(storedContent.slice(STRUCTURED_MESSAGE_PREFIX.length)) as { content?: unknown; presentation?: unknown };
    if (typeof decoded.content !== "string") return { content: storedContent };
    if (!isAiPresentation(decoded.presentation)) return { content: decoded.content };
    return { content: decoded.content, presentation: decoded.presentation };
  } catch {
    return { content: storedContent };
  }
}
