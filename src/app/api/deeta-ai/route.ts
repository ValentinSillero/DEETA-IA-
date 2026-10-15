import { aiQuestionSchema } from "@/lib/ai/validation";
import { askDeetaAi } from "@/lib/ai/service";
import { getFreshSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getFreshSession();
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_REQUEST" }, { status: 400 }); }
  const parsed = aiQuestionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST", message: parsed.error.issues[0]?.message }, { status: 400 });
  const result = await askDeetaAi(session.user.id, { question: parsed.data.question, conversationId: parsed.data.conversationId ?? null });
  if (result.ok) return Response.json(result);
  const status = result.reason === "FORBIDDEN" ? 403 : result.reason === "RATE_LIMIT" || result.reason === "MONTHLY_LIMIT" ? 429 : result.reason === "INVALID_CONVERSATION" ? 404 : 503;
  const headers = result.reason === "RATE_LIMIT" && result.retryAfterSeconds !== undefined
    ? { "Retry-After": String(result.retryAfterSeconds) }
    : undefined;
  return Response.json({ error: result.reason, retryAfterSeconds: result.retryAfterSeconds, rateLimitKind: result.rateLimitKind }, { status, headers });
}
