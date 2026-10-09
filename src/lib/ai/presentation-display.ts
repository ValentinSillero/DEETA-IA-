import type { AiPresentation } from "@/lib/ai/presentation";

export function visibleAiResponseText(content: string, presentation?: AiPresentation) {
  return presentation ? null : content;
}
