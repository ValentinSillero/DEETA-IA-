import "server-only";

import { fallbackPlanForEvidence, isAiToolResultAnswerable } from "@/lib/ai/answerability";
import { unsupportedNumericClaims } from "@/lib/ai/grounding";
import { buildAiPresentation } from "@/lib/ai/presentation";
import { DEETA_AI_EVIDENCE_LABEL, DEETA_AI_INSTRUCTIONS } from "@/lib/ai/prompt";
import { AiProviderError, type AiConversationMessage, type AiProvider, type AiProviderRequest, type AiProviderResult, type AiRateLimitKind } from "@/lib/ai/types";

type GroqToolCall = { id?: string; function?: { name?: string; arguments?: string } };
type GroqMessage = { content?: string | null; tool_calls?: GroqToolCall[] };
type GroqUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
};
type GroqResponse = { choices?: Array<{ message?: GroqMessage }>; usage?: GroqUsage };
type GroqErrorResponse = { error?: { message?: string; type?: string; code?: string } };

const MAX_TOOL_CALLS = 3;
const FINAL_MAX_TOKENS = 320;
const PLANNER_MAX_TOKENS = 220;
const RATE_LIMIT_HEADERS = [
  "retry-after",
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-ratelimit-reset-tokens",
] as const;

function rateLimitHeaders(response: Response) {
  return Object.fromEntries(RATE_LIMIT_HEADERS.map((name) => [name, response.headers.get(name)]));
}

function retryAfterSeconds(response: Response, message = "") {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1_000));
  }
  const match = message.match(/try again in\s+([\d.]+)\s*(ms|s|m)/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  return Math.ceil(match[2].toLowerCase() === "ms" ? amount / 1_000 : match[2].toLowerCase() === "m" ? amount * 60 : amount);
}

function rateLimitKind(message: string, headers: ReturnType<typeof rateLimitHeaders>): AiRateLimitKind {
  const normalized = message.toLowerCase();
  if (normalized.includes("tokens per minute") || normalized.includes("tpm")) return "TOKENS_PER_MINUTE";
  if (normalized.includes("tokens per day") || normalized.includes("tpd")) return "TOKENS_PER_DAY";
  if (normalized.includes("requests per minute") || normalized.includes("rpm")) return "REQUESTS_PER_MINUTE";
  if (normalized.includes("requests per day") || normalized.includes("rpd")) return "REQUESTS_PER_DAY";
  if (headers["x-ratelimit-remaining-tokens"] === "0") return "TOKENS_PER_MINUTE";
  if (headers["x-ratelimit-remaining-requests"] === "0") return "REQUESTS_PER_DAY";
  return "UNKNOWN";
}

function compactMessages(messages: AiConversationMessage[]) {
  return messages.slice(-4).map((message) => ({
    role: message.role === "USER" ? "user" : "assistant",
    content: message.content.slice(0, message.role === "USER" ? 400 : 700),
  }));
}

function usageValues(usage: GroqUsage | undefined) {
  return {
    inputTokens: Number(usage?.prompt_tokens ?? 0),
    outputTokens: Number(usage?.completion_tokens ?? 0),
    totalTokens: Number(usage?.total_tokens ?? 0),
    cachedTokens: Number(usage?.prompt_tokens_details?.cached_tokens ?? 0),
  };
}

function addUsage(target: ReturnType<typeof usageValues>, usage: GroqUsage | undefined) {
  const values = usageValues(usage);
  target.inputTokens += values.inputTokens;
  target.outputTokens += values.outputTokens;
  target.totalTokens += values.totalTokens;
  target.cachedTokens += values.cachedTokens;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function emptyEvidenceAnswer(evidence: unknown[]) {
  for (const entryValue of evidence) {
    const entry = record(entryValue);
    const data = record(entry?.data);
    if (!entry || !data) continue;
    if (entry.tool === "get_top_product_analysis" && data.hasSales === false && data.product === null) {
      return "Todavía no hay ventas registradas en este período para identificar un producto más vendido.";
    }
    if (entry.tool === "get_inventory_analysis" && Array.isArray(data.products) && data.products.length === 0) {
      if (data.hasProducts === false) return "Todavía no hay productos cargados para analizar el inventario.";
      if (data.focus === "REORDER") return "No encontré productos que necesiten reposición con la información disponible.";
      if (data.focus === "SLOW") return "No encontré productos con baja rotación en el período analizado.";
      if (data.focus === "EXCESS") return "No encontré productos con exceso de stock según su ritmo reciente.";
      return "No encontré productos que coincidan con ese estado de stock.";
    }
    if (entry.tool === "get_product_sales_ranking" && Array.isArray(data.products) && data.products.length === 0) {
      return data.hasProducts === false
        ? "Todavía no hay productos cargados para analizar sus ventas."
        : "No hay ventas registradas en este período para responder esa consulta.";
    }
  }
  return undefined;
}

export class GroqChatCompletionsProvider implements AiProvider {
  readonly name = "groq";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async createCompletion(body: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const limits = rateLimitHeaders(response);
      if (response.status === 429) {
        let errorPayload: GroqErrorResponse = {};
        try { errorPayload = await response.json() as GroqErrorResponse; } catch { /* Respuesta sin JSON. */ }
        const message = errorPayload.error?.message ?? "";
        const kind = rateLimitKind(message, limits);
        const retryAfter = retryAfterSeconds(response, message);
        console.warn("[DEETA AI][Groq 429]", { status: 429, kind, retryAfterSeconds: retryAfter, headers: limits });
        throw new AiProviderError("RATE_LIMIT", retryAfter, kind);
      }
      if (process.env.NODE_ENV === "development") {
        console.info("[DEETA AI][Groq response]", { status: response.status, headers: limits });
      }
      if (response.status === 400) throw new AiProviderError("INVALID_RESPONSE");
      if (!response.ok) throw new AiProviderError("UNAVAILABLE");
      try {
        return await response.json() as GroqResponse;
      } catch {
        throw new AiProviderError("INVALID_RESPONSE");
      }
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (controller.signal.aborted) throw new AiProviderError("TIMEOUT");
      throw new AiProviderError("UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }

  private finalMessages(messages: AiConversationMessage[], evidence: unknown[]) {
    const compact = compactMessages(messages);
    const latest = compact.at(-1);
    const earlier = latest?.role === "user" ? compact.slice(0, -1) : compact;
    return [
      { role: "system", content: DEETA_AI_INSTRUCTIONS },
      ...earlier,
      { role: "system", content: `${DEETA_AI_EVIDENCE_LABEL}\n${JSON.stringify(evidence)}` },
      ...(latest?.role === "user" ? [latest] : []),
    ];
  }

  private async finalResponse(messages: AiConversationMessage[], evidence: unknown[]) {
    return this.createCompletion({
      model: this.model,
      messages: this.finalMessages(messages, evidence),
      temperature: 0.1,
      max_completion_tokens: FINAL_MAX_TOKENS,
      reasoning_effort: "low",
      store: false,
    });
  }

  private result(
    response: GroqResponse,
    evidence: unknown[],
    usage: ReturnType<typeof usageValues>,
    toolsUsed: string[],
    groqRequests: number,
    messages: AiConversationMessage[],
  ): AiProviderResult {
    addUsage(usage, response.usage);
    const text = response.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text || unsupportedNumericClaims(text, evidence).length > 0) throw new AiProviderError("INVALID_RESPONSE");
    const question = messages.findLast((message) => message.role === "USER")?.content ?? "";
    const presentation = buildAiPresentation(evidence, question);
    const result = { text, model: this.model, ...usage, toolCalls: toolsUsed.length, toolsUsed, providerRequests: groqRequests, presentation };
    if (process.env.NODE_ENV === "development") {
      console.info("[DEETA AI][Groq usage]", {
        model: this.model,
        groqRequests,
        rounds: groqRequests,
        toolsUsed,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedTokens: usage.cachedTokens,
      });
    }
    return result;
  }

  private structuredResult(
    evidence: unknown[],
    usage: ReturnType<typeof usageValues>,
    toolsUsed: string[],
    groqRequests: number,
    messages: AiConversationMessage[],
  ): AiProviderResult | undefined {
    const question = messages.findLast((message) => message.role === "USER")?.content ?? "";
    const presentation = buildAiPresentation(evidence, question);
    if (!presentation) return undefined;
    return {
      text: presentation.title,
      model: this.model,
      ...usage,
      toolCalls: toolsUsed.length,
      toolsUsed,
      providerRequests: groqRequests,
      presentation,
    };
  }

  private emptyResult(
    evidence: unknown[],
    usage: ReturnType<typeof usageValues>,
    toolsUsed: string[],
    groqRequests: number,
  ): AiProviderResult | undefined {
    const text = emptyEvidenceAnswer(evidence);
    if (!text) return undefined;
    return {
      text,
      model: this.model,
      ...usage,
      toolCalls: toolsUsed.length,
      toolsUsed,
      providerRequests: groqRequests,
    };
  }

  async respond(request: AiProviderRequest): Promise<AiProviderResult> {
    const allowedTools = new Set(request.tools.map((tool) => tool.name));
    const usage = usageValues(undefined);
    const evidence: unknown[] = [];
    const toolsUsed: string[] = [];

    if (request.preparedTool) {
      if (!allowedTools.has(request.preparedTool.name)) throw new AiProviderError("INVALID_RESPONSE");
      let data: unknown;
      try { data = await request.executeTool(request.preparedTool.name, request.preparedTool.arguments); } catch { throw new AiProviderError("INVALID_RESPONSE"); }
      if (!isAiToolResultAnswerable(request.preparedTool.name, data)) throw new AiProviderError("INVALID_RESPONSE");
      evidence.push({ tool: request.preparedTool.name, data });
      toolsUsed.push(request.preparedTool.name);
      const structured = this.structuredResult(evidence, usage, toolsUsed, 0, request.messages);
      if (structured) return structured;
      const empty = this.emptyResult(evidence, usage, toolsUsed, 0);
      if (empty) return empty;
      const response = await this.finalResponse(request.messages, evidence);
      return this.result(response, evidence, usage, toolsUsed, 1, request.messages);
    }

    const tools = request.tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
    const planning = await this.createCompletion({
      model: this.model,
      messages: [{ role: "system", content: DEETA_AI_INSTRUCTIONS }, ...compactMessages(request.messages)],
      tools,
      tool_choice: "required",
      parallel_tool_calls: false,
      temperature: 0,
      max_completion_tokens: PLANNER_MAX_TOKENS,
      reasoning_effort: "low",
      store: false,
    });
    addUsage(usage, planning.usage);
    const calls = planning.choices?.[0]?.message?.tool_calls ?? [];
    if (calls.length === 0 || calls.length > MAX_TOOL_CALLS) throw new AiProviderError("INVALID_RESPONSE");
    for (const call of calls) {
      const name = call.function?.name;
      const rawArguments = call.function?.arguments;
      if (!name || typeof rawArguments !== "string" || !allowedTools.has(name)) throw new AiProviderError("INVALID_RESPONSE");
      let args: unknown;
      try { args = JSON.parse(rawArguments); } catch { throw new AiProviderError("INVALID_RESPONSE"); }
      let data: unknown;
      try { data = await request.executeTool(name, args); } catch { throw new AiProviderError("INVALID_RESPONSE"); }
      evidence.push({ tool: name, data });
      toolsUsed.push(name);
    }
    const fallback = fallbackPlanForEvidence(request.messages, evidence);
    if (fallback && allowedTools.has(fallback.name)) {
      if (toolsUsed.length >= MAX_TOOL_CALLS) throw new AiProviderError("INVALID_RESPONSE");
      let data: unknown;
      try { data = await request.executeTool(fallback.name, fallback.arguments); } catch { throw new AiProviderError("INVALID_RESPONSE"); }
      if (!isAiToolResultAnswerable(fallback.name, data)) throw new AiProviderError("INVALID_RESPONSE");
      evidence.push({ tool: fallback.name, data });
      toolsUsed.push(fallback.name);
    }
    const structured = this.structuredResult(evidence, usage, toolsUsed, 1, request.messages);
    if (structured) return structured;
    const empty = this.emptyResult(evidence, usage, toolsUsed, 1);
    if (empty) return empty;
    const response = await this.finalResponse(request.messages, evidence);
    return this.result(response, evidence, usage, toolsUsed, 2, request.messages);
  }
}
