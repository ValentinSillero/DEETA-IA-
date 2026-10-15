import "server-only";

import { cache } from "react";

import { getSqlClient } from "@/db";

export type AnalyticsContext = {
  businessId: string;
  timezone: string;
  today: string;
  historyDays: number;
};

// React `cache` keys on the exact argument list, so `(userId)` and
// `(userId, undefined)` used to be two different entries. Normalizing the
// optional business id to `null` lets page, financial and intelligent
// analytics share a single context query per request.
const getAnalyticsContextCached = cache(async (
  userId: string,
  businessId: string | null,
): Promise<AnalyticsContext | null> => {
  const sql = getSqlClient();
  const rows = await sql`
    select b.id as business_id, b.timezone, timezone(b.timezone, now())::date::text as today,
      greatest(1, coalesce(
        timezone(b.timezone, now())::date - min(timezone(b.timezone, s.created_at)::date),
        timezone(b.timezone, now())::date - timezone(b.timezone, b.created_at)::date
      ) + 1)::int as history_days
    from business b
    inner join business_member bm on bm.business_id = b.id and bm.user_id = ${userId}
    left join sale s on s.business_id = b.id and s.status = 'COMPLETED'
    where (${businessId}::text is null or b.id = ${businessId})
    group by b.id, b.timezone, b.created_at
    limit 1
  `;
  const row = rows[0];
  return row ? {
    businessId: String(row.business_id),
    timezone: String(row.timezone),
    today: String(row.today),
    historyDays: Number(row.history_days),
  } : null;
});

export function getAnalyticsContextForUser(userId: string, businessId?: string | null) {
  return getAnalyticsContextCached(userId, businessId ?? null);
}
