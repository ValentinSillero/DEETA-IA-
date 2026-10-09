import type { AiPresentation } from "@/lib/ai/presentation";

export type AiConversationMessage = { role: "USER" | "ASSISTANT"; content: string };

export type AiToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: true;
};

export type AiProviderResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  toolCalls: number;
  toolsUsed: string[];
  providerRequests: number;
  presentation?: AiPresentation;
};

export type AiPreparedTool = { name: string; arguments: unknown };

export type AiRateLimitKind =
  | "REQUESTS_PER_MINUTE"
  | "REQUESTS_PER_DAY"
  | "TOKENS_PER_MINUTE"
  | "TOKENS_PER_DAY"
  | "UNKNOWN";

export type AiProviderRequest = {
  messages: AiConversationMessage[];
  tools: AiToolDefinition[];
  executeTool: (name: string, rawArguments: unknown) => Promise<unknown>;
  preparedTool?: AiPreparedTool;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  respond(request: AiProviderRequest): Promise<AiProviderResult>;
}

export class AiProviderError extends Error {
  constructor(
    public readonly code: "TIMEOUT" | "UNAVAILABLE" | "INVALID_RESPONSE" | "RATE_LIMIT",
    public readonly retryAfterSeconds?: number,
    public readonly rateLimitKind?: AiRateLimitKind,
  ) {
    super(code);
    this.name = "AiProviderError";
  }
}
