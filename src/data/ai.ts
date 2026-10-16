import "server-only";

import { getSqlClient } from "@/db";
import type { MemberRole } from "@/db/schema";
import { decodeAiMessageContent, encodeAiMessageContent } from "@/lib/ai/message-content";
import type { AiPresentation } from "@/lib/ai/presentation";
import type { AiConversationMessage } from "@/lib/ai/types";
import { rolesWith } from "@/lib/permissions";

export type AiAccessContext = {
  businessId: string;
  userId: string;
  role: MemberRole;
  timezone: string;
};

export async function getAiAccessForUser(userId: string): Promise<AiAccessContext | null> {
  const sql = getSqlClient();
  const rows = await sql`
    select bm.business_id, bm.user_id, bm.role, b.timezone
    from active_membership bm inner join business b on b.id = bm.business_id
    where bm.user_id = ${userId} and bm.role = any(${rolesWith("AI_USE")}::member_role[]) limit 1
  `;
  const row = rows[0];
  return row ? { businessId: String(row.business_id), userId: String(row.user_id), role: row.role as AiAccessContext["role"], timezone: String(row.timezone) } : null;
}

export async function getLatestAiConversationForUser(userId: string) {
  const sql = getSqlClient();
  const rows = await sql`
    with latest as (
      select c.id, c.business_id, c.title
      from ai_conversation c
      inner join active_membership bm
        on bm.business_id = c.business_id
       and bm.user_id = ${userId}
       and bm.role = any(${rolesWith("AI_USE")}::member_role[])
      where c.user_id = ${userId}
      order by c.updated_at desc
      limit 1
    )
    select latest.id as conversation_id, latest.title,
      message.id as message_id, message.role, message.content, message.created_at
    from latest
    left join lateral (
      select m.id, m.role, m.content, m.created_at
      from ai_message m
      where m.conversation_id = latest.id and m.business_id = latest.business_id
      order by m.created_at desc
      limit 30
    ) message on true
    order by message.created_at asc
  `;
  const conversation = rows[0];
  if (!conversation) return null;
  return {
    id: String(conversation.conversation_id), title: String(conversation.title),
    messages: rows.flatMap((message) => {
      if (!message.message_id) return [];
      const decoded = decodeAiMessageContent(String(message.content));
      return [{ id: String(message.message_id), role: message.role as "USER" | "ASSISTANT", content: decoded.content, presentation: decoded.presentation, createdAt: new Date(String(message.created_at)) }];
    }),
  };
}

export async function getOrCreateAiConversation(userId: string, conversationId: string | null, title: string) {
  const sql = getSqlClient();
  if (conversationId) {
    const existing = await sql`
      select c.id from ai_conversation c
      inner join active_membership bm on bm.business_id = c.business_id and bm.user_id = ${userId} and bm.role = any(${rolesWith("AI_USE")}::member_role[])
      where c.id = ${conversationId} and c.user_id = ${userId} limit 1
    `;
    return existing[0] ? String(existing[0].id) : null;
  }
  const id = crypto.randomUUID();
  const rows = await sql`
    insert into ai_conversation (id, business_id, user_id, title)
    select ${id}, bm.business_id, ${userId}, ${title}
    from active_membership bm where bm.user_id = ${userId} and bm.role = any(${rolesWith("AI_USE")}::member_role[])
    returning id
  `;
  return rows[0] ? String(rows[0].id) : null;
}

export async function addAiMessageForUser(userId: string, conversationId: string, role: "USER" | "ASSISTANT", content: string, presentation?: AiPresentation) {
  const sql = getSqlClient();
  const id = crypto.randomUUID();
  const storedContent = role === "ASSISTANT" ? encodeAiMessageContent(content, presentation) : content;
  const rows = await sql`
    with allowed as (
      select c.id, c.business_id from ai_conversation c
      inner join active_membership bm on bm.business_id = c.business_id and bm.user_id = ${userId} and bm.role = any(${rolesWith("AI_USE")}::member_role[])
      where c.id = ${conversationId} and c.user_id = ${userId} limit 1
    ), inserted as (
      insert into ai_message (id, business_id, conversation_id, user_id, role, content)
      select ${id}, business_id, id, ${userId}, ${role}::ai_message_role, ${storedContent} from allowed
      returning id
    ), touched as (
      update ai_conversation c set updated_at = now() from allowed a where c.id = a.id returning c.id
    ) select id from inserted
  `;
  return rows[0] ? String(rows[0].id) : null;
}

export async function getRecentAiMessagesForUser(userId: string, conversationId: string, limit = 10): Promise<AiConversationMessage[]> {
  const sql = getSqlClient();
  const rows = await sql`
    select m.role, m.content from ai_message m
    inner join ai_conversation c on c.id = m.conversation_id and c.business_id = m.business_id
    inner join active_membership bm on bm.business_id = c.business_id and bm.user_id = ${userId} and bm.role = any(${rolesWith("AI_USE")}::member_role[])
    where c.id = ${conversationId} and c.user_id = ${userId}
    order by m.created_at desc limit ${limit}
  `;
  return rows.reverse().map((row) => ({ role: row.role as AiConversationMessage["role"], content: decodeAiMessageContent(String(row.content)).content }));
}

export async function reserveAiUsage(
  context: AiAccessContext,
  conversationId: string,
  provider: string,
  model: string,
  minuteLimit: number,
  monthlyLimit: number,
) {
  const sql = getSqlClient();
  const id = crypto.randomUUID();
  const rows = await sql`
    with counts as (
      select
        count(*) filter (where created_at >= now() - interval '1 minute' and coalesce(error_code, '') <> 'RATE_LIMIT')::int as minute_count,
        count(*) filter (where timezone(${context.timezone}, created_at) >= date_trunc('month', timezone(${context.timezone}, now())) and coalesce(error_code, '') <> 'RATE_LIMIT')::int as month_count
      from ai_usage where business_id = ${context.businessId}
    ), inserted as (
      insert into ai_usage (id, business_id, user_id, conversation_id, provider, model, status)
      select ${id}, ${context.businessId}, ${context.userId}, ${conversationId}, ${provider}, ${model}, 'STARTED'
      from counts where minute_count < ${minuteLimit} and month_count < ${monthlyLimit}
      returning id
    )
    select counts.minute_count, counts.month_count, inserted.id from counts left join inserted on true
  `;
  const row = rows[0];
  if (row?.id) return { ok: true as const, id: String(row.id) };
  const reason: "MONTHLY_LIMIT" | "RATE_LIMIT" = Number(row?.month_count ?? 0) >= monthlyLimit ? "MONTHLY_LIMIT" : "RATE_LIMIT";
  await sql`
    insert into ai_usage (id, business_id, user_id, conversation_id, provider, model, status, error_code, completed_at)
    values (${crypto.randomUUID()}, ${context.businessId}, ${context.userId}, ${conversationId}, ${provider}, ${model}, 'FAILED', ${reason}, now())
  `;
  return { ok: false as const, reason };
}

export async function finishAiUsage(
  usageId: string,
  result: { ok: true; toolCalls: number; inputTokens: number; outputTokens: number; totalTokens: number } | { ok: false; errorCode: string },
) {
  const sql = getSqlClient();
  if (result.ok) {
    await sql`
      update ai_usage set status = 'SUCCEEDED', tool_calls = ${result.toolCalls}, input_tokens = ${result.inputTokens},
        output_tokens = ${result.outputTokens}, total_tokens = ${result.totalTokens}, completed_at = now()
      where id = ${usageId} and status = 'STARTED'
    `;
  } else {
    await sql`update ai_usage set status = 'FAILED', error_code = ${result.errorCode}, completed_at = now() where id = ${usageId} and status = 'STARTED'`;
  }
}
