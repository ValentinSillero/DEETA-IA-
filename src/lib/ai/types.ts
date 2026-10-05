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
  toolCalls: number;
};

export type AiProviderRequest = {
  messages: AiConversationMessage[];
  tools: AiToolDefinition[];
  executeTool: (name: string, rawArguments: unknown) => Promise<unknown>;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  respond(request: AiProviderRequest): Promise<AiProviderResult>;
}

export class AiProviderError extends Error {
  constructor(public readonly code: "TIMEOUT" | "UNAVAILABLE" | "INVALID_RESPONSE") {
    super(code);
    this.name = "AiProviderError";
  }
}
