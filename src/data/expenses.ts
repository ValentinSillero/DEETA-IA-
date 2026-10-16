import "server-only";

import { getSqlClient } from "@/db";
import type { CreateExpenseInput } from "@/lib/expense-validations";
import { rolesWith } from "@/lib/permissions";

export type ExpenseCategoryDto = { id: string; name: string; isActive: boolean; usedCount: number };
export type ExpenseDto = {
  id: string;
  description: string;
  amountCents: number;
  paymentMethod: "CASH" | "TRANSFER" | "CARD" | "OTHER";
  expenseDate: string;
  status: "ACTIVE" | "CANCELLED";
  categoryId: string;
  categoryName: string;
  cashSessionId: string | null;
  createdByName: string;
  cancelledAt: Date | null;
  cancellationReason: string | null;
};

export async function getExpenseContextForUser(userId: string) {
  const sql = getSqlClient();
  const rows = await sql`
    select b.timezone, timezone(b.timezone, now())::date::text as today,
      bm.role,
      (select cs.id from cash_session cs where cs.business_id = b.id and cs.status = 'OPEN' limit 1) as open_cash_id
    from active_membership bm inner join business b on b.id = bm.business_id
    where bm.user_id = ${userId} limit 1
  `;
  const row = rows[0];
  return row ? {
    timezone: String(row.timezone), today: String(row.today), role: String(row.role) as "OWNER" | "ADMIN" | "EMPLOYEE",
    openCashId: row.open_cash_id ? String(row.open_cash_id) : null,
  } : null;
}

export async function getExpenseCategoriesForUser(userId: string, includeInactive = false): Promise<ExpenseCategoryDto[]> {
  const sql = getSqlClient();
  const rows = await sql`
    select c.id, c.name, c.is_active, count(e.id)::int as used_count
    from expense_category c
    inner join active_membership bm on bm.business_id = c.business_id and bm.user_id = ${userId}
    left join expense e on e.category_id = c.id and e.business_id = c.business_id
    where (${includeInactive}::boolean = true or c.is_active = true)
    group by c.id
    order by c.is_active desc, c.name
  `;
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), isActive: Boolean(row.is_active), usedCount: Number(row.used_count) }));
}

export async function createExpenseCategoryForUser(userId: string, name: string) {
  const sql = getSqlClient();
  const id = crypto.randomUUID();
  const rows = await sql`
    insert into expense_category (id, business_id, name)
    select ${id}, bm.business_id, ${name}
    from active_membership bm
    where bm.user_id = ${userId} and bm.role = any(${rolesWith("EXPENSE_CATEGORY_MANAGE")}::member_role[])
    on conflict (business_id, name) do nothing
    returning id
  `;
  return rows[0] ? String(rows[0].id) : null;
}

export async function updateExpenseCategoryForUser(userId: string, categoryId: string, name: string) {
  const sql = getSqlClient();
  const rows = await sql`
    update expense_category c set name = ${name}, updated_at = now()
    where c.id = ${categoryId}
      and exists (select 1 from active_membership bm where bm.business_id = c.business_id and bm.user_id = ${userId} and bm.role = any(${rolesWith("EXPENSE_CATEGORY_MANAGE")}::member_role[]))
    returning id
  `;
  return rows.length > 0;
}

export async function toggleExpenseCategoryForUser(userId: string, categoryId: string, isActive: boolean) {
  const sql = getSqlClient();
  const rows = await sql`
    update expense_category c set is_active = ${isActive}, updated_at = now()
    where c.id = ${categoryId}
      and exists (select 1 from active_membership bm where bm.business_id = c.business_id and bm.user_id = ${userId} and bm.role = any(${rolesWith("EXPENSE_CATEGORY_MANAGE")}::member_role[]))
    returning id
  `;
  return rows.length > 0;
}

export type CreateExpenseResult = { ok: true; id: string; linkedToCash: boolean } | { ok: false; reason: "INVALID_CATEGORY" | "INVALID_DATE" | "NO_BUSINESS" };

export async function createExpenseForUser(userId: string, input: CreateExpenseInput): Promise<CreateExpenseResult> {
  const sql = getSqlClient();
  const id = crypto.randomUUID();
  const rows = await sql`
    with member as (
      select bm.business_id, b.timezone from active_membership bm inner join business b on b.id = bm.business_id
      where bm.user_id = ${userId} and bm.role = any(${rolesWith("EXPENSE_CREATE")}::member_role[]) limit 1
    ), valid_category as (
      select c.id, c.business_id from expense_category c inner join member m on m.business_id = c.business_id
      where c.id = ${input.categoryId} and c.is_active = true
        and ${input.expenseDate}::date <= timezone(m.timezone, now())::date
    ), open_cash as (
      select cs.id, cs.business_id from cash_session cs inner join member m on m.business_id = cs.business_id
      where cs.status = 'OPEN' for update of cs
    ), created as (
      insert into expense (
        id, business_id, category_id, description, amount_cents, payment_method,
        cash_session_id, expense_date, status, created_by
      )
      select ${id}, c.business_id, c.id, ${input.description}, ${input.amountCents},
        ${input.paymentMethod}::expense_payment_method,
        case when ${input.paymentMethod} = 'CASH' then cash.id else null end,
        ${input.expenseDate}::date, 'ACTIVE', ${userId}
      from valid_category c left join open_cash cash on cash.business_id = c.business_id
      returning id, business_id, cash_session_id, amount_cents, payment_method
    ), updated_cash as (
      update cash_session cs set expected_cash_cents = cs.expected_cash_cents - e.amount_cents, updated_at = now()
      from created e where cs.id = e.cash_session_id and e.payment_method = 'CASH' and cs.status = 'OPEN'
      returning cs.id
    )
    select e.id, e.cash_session_id, (select count(*) from updated_cash)::int as cash_updates from created e
  `;
  const row = rows[0];
  if (row) return { ok: true, id: String(row.id), linkedToCash: Boolean(row.cash_session_id) && Number(row.cash_updates) === 1 };
  const membership = await sql`
    select timezone(b.timezone, now())::date::text as today
    from active_membership bm inner join business b on b.id = bm.business_id where bm.user_id = ${userId} limit 1
  `;
  if (!membership.length) return { ok: false, reason: "NO_BUSINESS" };
  return { ok: false, reason: input.expenseDate > String(membership[0].today) ? "INVALID_DATE" : "INVALID_CATEGORY" };
}

function mapExpense(row: Record<string, unknown>): ExpenseDto {
  return {
    id: String(row.id), description: String(row.description), amountCents: Number(row.amount_cents),
    paymentMethod: row.payment_method as ExpenseDto["paymentMethod"], expenseDate: String(row.expense_date),
    status: row.status as ExpenseDto["status"], categoryId: String(row.category_id), categoryName: String(row.category_name),
    cashSessionId: row.cash_session_id ? String(row.cash_session_id) : null, createdByName: String(row.created_by_name),
    cancelledAt: row.cancelled_at ? new Date(String(row.cancelled_at)) : null,
    cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : null,
  };
}

export async function getExpensesForUser(userId: string, filters: { start: string; end: string; categoryId?: string }): Promise<ExpenseDto[]> {
  const sql = getSqlClient();
  const rows = await sql`
    select e.*, c.name as category_name, creator.name as created_by_name
    from expense e
    inner join active_membership bm on bm.business_id = e.business_id and bm.user_id = ${userId}
    inner join expense_category c on c.id = e.category_id and c.business_id = e.business_id
    inner join "user" creator on creator.id = e.created_by
    where e.expense_date between ${filters.start}::date and ${filters.end}::date
      and (${filters.categoryId ?? null}::text is null or e.category_id = ${filters.categoryId ?? null})
    order by e.expense_date desc, e.created_at desc limit 500
  `;
  return rows.map((row) => mapExpense(row as Record<string, unknown>));
}

export type ExpensePeriodFilter = {
  period: "TODAY" | "WEEK" | "MONTH" | "CUSTOM";
  start?: string;
  end?: string;
  categoryId?: string;
};

// Same ranges as the Gastos page computes from the business "today", but
// resolved inside SQL so the list can load in parallel with the page context
// instead of waiting for it (one less sequential round trip per navigation).
// Unknown categories fall back to "all categories", like the page did before.
export async function getExpensesForPeriodForUser(userId: string, filters: ExpensePeriodFilter): Promise<ExpenseDto[]> {
  const sql = getSqlClient();
  const rows = await sql`
    with ctx as (
      select b.id as business_id, timezone(b.timezone, now())::date as today
      from active_membership bm inner join business b on b.id = bm.business_id
      where bm.user_id = ${userId}
      limit 1
    ), bounds as (
      select business_id, today, date_trunc('month', today)::date as month_start,
        coalesce(${filters.start ?? null}::date, date_trunc('month', today)::date) as custom_start,
        coalesce(${filters.end ?? null}::date, today) as custom_end
      from ctx
    ), period_range as (
      select business_id,
        case
          when ${filters.period} = 'TODAY' then today
          when ${filters.period} = 'WEEK' then today - 6
          when ${filters.period} = 'CUSTOM' and custom_start <= custom_end then custom_start
          else month_start
        end as start_date,
        case
          when ${filters.period} = 'CUSTOM' and custom_start <= custom_end then custom_end
          else today
        end as end_date
      from bounds
    ), category_filter as (
      select c.id
      from expense_category c inner join period_range r on r.business_id = c.business_id
      where c.id = ${filters.categoryId ?? null}
    )
    select e.*, c.name as category_name, creator.name as created_by_name
    from expense e
    inner join period_range r on r.business_id = e.business_id
    inner join expense_category c on c.id = e.category_id and c.business_id = e.business_id
    inner join "user" creator on creator.id = e.created_by
    where e.expense_date between r.start_date and r.end_date
      and (not exists (select 1 from category_filter) or e.category_id in (select id from category_filter))
    order by e.expense_date desc, e.created_at desc limit 500
  `;
  return rows.map((row) => mapExpense(row as Record<string, unknown>));
}

export async function getExpenseForUser(userId: string, expenseId: string) {
  const sql = getSqlClient();
  const rows = await sql`
    select e.*, c.name as category_name, creator.name as created_by_name
    from expense e
    inner join active_membership bm on bm.business_id = e.business_id and bm.user_id = ${userId}
    inner join expense_category c on c.id = e.category_id and c.business_id = e.business_id
    inner join "user" creator on creator.id = e.created_by
    where e.id = ${expenseId} limit 1
  `;
  return rows[0] ? mapExpense(rows[0] as Record<string, unknown>) : null;
}

export async function getExpenseTotalsForUser(userId: string) {
  const sql = getSqlClient();
  const rows = await sql`
    with context as (
      select b.id as business_id, timezone(b.timezone, now())::date as today
      from business b inner join active_membership bm on bm.business_id = b.id and bm.user_id = ${userId}
    )
    select
      coalesce(sum(e.amount_cents) filter (where e.expense_date = c.today and e.status = 'ACTIVE'), 0)::bigint as today_cents,
      coalesce(sum(e.amount_cents) filter (where e.expense_date between date_trunc('month', c.today)::date and c.today and e.status = 'ACTIVE'), 0)::bigint as month_cents
    from context c left join expense e on e.business_id = c.business_id group by c.today
  `;
  return { todayCents: Number(rows[0]?.today_cents ?? 0), monthCents: Number(rows[0]?.month_cents ?? 0) };
}

export type CancelExpenseResult = { ok: true; cashRestored: boolean } | { ok: false; reason: "NOT_FOUND" | "ALREADY_CANCELLED" | "FORBIDDEN" };

export async function cancelExpenseForUser(userId: string, expenseId: string, reason: string | null): Promise<CancelExpenseResult> {
  const sql = getSqlClient();
  const rows = await sql`
    with member as (
      select business_id from active_membership where user_id = ${userId} and role = any(${rolesWith("EXPENSE_CANCEL")}::member_role[]) limit 1
    ), target as (
      select e.* from expense e inner join member m on m.business_id = e.business_id
      where e.id = ${expenseId} and e.status = 'ACTIVE' for update of e
    ), open_cash as (
      select cs.id from cash_session cs inner join target e on e.cash_session_id = cs.id and e.business_id = cs.business_id
      where cs.status = 'OPEN' for update of cs
    ), cancelled as (
      update expense e set status = 'CANCELLED', cancelled_by = ${userId}, cancelled_at = now(),
        cancellation_reason = ${reason}, updated_at = now()
      from target t where e.id = t.id returning e.id, e.cash_session_id, e.amount_cents, e.payment_method
    ), restored_cash as (
      update cash_session cs set expected_cash_cents = cs.expected_cash_cents + e.amount_cents, updated_at = now()
      from cancelled e inner join open_cash oc on oc.id = e.cash_session_id
      where cs.id = oc.id and e.payment_method = 'CASH' returning cs.id
    )
    select c.id, (select count(*) from restored_cash)::int as cash_updates from cancelled c
  `;
  if (rows[0]) return { ok: true, cashRestored: Number(rows[0].cash_updates) === 1 };
  const current = await getExpenseForUser(userId, expenseId);
  if (!current) return { ok: false, reason: "NOT_FOUND" };
  if (current.status === "CANCELLED") return { ok: false, reason: "ALREADY_CANCELLED" };
  return { ok: false, reason: "FORBIDDEN" };
}
