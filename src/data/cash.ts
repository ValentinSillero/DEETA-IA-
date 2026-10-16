import "server-only";

import { getSqlClient } from "@/db";

export type CashSessionDto = {
  id: string;
  openingAmountCents: number;
  expectedCashCents: number;
  declaredCashCents: number | null;
  differenceCents: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: Date;
  closedAt: Date | null;
  openedByName: string;
  closedByName: string | null;
  cashSalesCents: number;
  cashOperations: number;
  cashExpensesCents: number;
  cashExpenseOperations: number;
  cashCustomerPaymentsCents: number;
  cashCustomerPaymentOperations: number;
  timezone: string;
};

function mapCashSession(row: Record<string, unknown>): CashSessionDto {
  return {
    id: String(row.id),
    openingAmountCents: Number(row.opening_amount_cents),
    expectedCashCents: Number(row.expected_cash_cents),
    declaredCashCents: row.declared_cash_cents === null ? null : Number(row.declared_cash_cents),
    differenceCents: row.difference_cents === null ? null : Number(row.difference_cents),
    status: row.status as CashSessionDto["status"],
    openedAt: new Date(String(row.opened_at)),
    closedAt: row.closed_at ? new Date(String(row.closed_at)) : null,
    openedByName: String(row.opened_by_name),
    closedByName: row.closed_by_name ? String(row.closed_by_name) : null,
    cashSalesCents: Number(row.cash_sales_cents ?? 0),
    cashOperations: Number(row.cash_operations ?? 0),
    cashExpensesCents: Number(row.cash_expenses_cents ?? 0),
    cashExpenseOperations: Number(row.cash_expense_operations ?? 0),
    cashCustomerPaymentsCents: Number(row.cash_customer_payments_cents ?? 0),
    cashCustomerPaymentOperations: Number(row.cash_customer_payment_operations ?? 0),
    timezone: String(row.timezone),
  };
}

const cashSessionSelect = `
  select cs.*, b.timezone, opener.name as opened_by_name, closer.name as closed_by_name,
    coalesce(sales.cash_sales_cents, 0)::bigint as cash_sales_cents,
    coalesce(sales.cash_operations, 0)::int as cash_operations,
    coalesce(expenses.cash_expenses_cents, 0)::bigint as cash_expenses_cents,
    coalesce(expenses.cash_expense_operations, 0)::int as cash_expense_operations,
    coalesce(customer_payments.cash_customer_payments_cents, 0)::bigint as cash_customer_payments_cents,
    coalesce(customer_payments.cash_customer_payment_operations, 0)::int as cash_customer_payment_operations
  from cash_session cs
  inner join business_member bm on bm.business_id = cs.business_id
  inner join business b on b.id = cs.business_id
  inner join "user" opener on opener.id = cs.opened_by
  left join "user" closer on closer.id = cs.closed_by
  left join lateral (
    -- Solo la parte cobrada en efectivo: el fiado y las transferencias no entran a la caja.
    -- Las ventas anteriores al cobro dividido usan su único medio de pago.
    select coalesce(sum(cash.amount_cents), 0)::bigint as cash_sales_cents, count(*) filter (where cash.amount_cents > 0)::int as cash_operations
    from sale s
    cross join lateral (
      select case
        when exists (select 1 from sale_payment sp where sp.sale_id = s.id)
          then (select coalesce(sum(sp.amount_cents), 0) from sale_payment sp where sp.sale_id = s.id and sp.method = 'CASH')
        when s.payment_method = 'CASH' then s.total_cents
        else 0
      end as amount_cents
    ) cash
    where s.cash_session_id = cs.id and s.business_id = cs.business_id
      and s.status = 'COMPLETED'
  ) sales on true
  left join lateral (
    select coalesce(sum(-m.amount_cents), 0)::bigint as cash_customer_payments_cents, count(*)::int as cash_customer_payment_operations
    from customer_account_movement m
    where m.cash_session_id = cs.id and m.business_id = cs.business_id
      and m.type = 'PAYMENT' and m.payment_method = 'CASH'
  ) customer_payments on true
  left join lateral (
    select coalesce(sum(e.amount_cents), 0)::bigint as cash_expenses_cents, count(*)::int as cash_expense_operations
    from expense e
    where e.cash_session_id = cs.id and e.business_id = cs.business_id
      and e.status = 'ACTIVE' and e.payment_method = 'CASH'
  ) expenses on true
`;

export async function getOpenCashSessionForUser(userId: string) {
  const sqlClient = getSqlClient();
  const rows = await sqlClient.query(`${cashSessionSelect}
    where bm.user_id = $1 and cs.status = 'OPEN'
    limit 1`, [userId]);
  return rows[0] ? mapCashSession(rows[0] as Record<string, unknown>) : null;
}

export async function getCashSessionsForUser(userId: string): Promise<CashSessionDto[]> {
  const sqlClient = getSqlClient();
  const rows = await sqlClient.query(`${cashSessionSelect}
    where bm.user_id = $1
    order by cs.opened_at desc
    limit 100`, [userId]);
  return rows.map((row) => mapCashSession(row as Record<string, unknown>));
}

export async function getCashSessionForUser(userId: string, cashSessionId: string) {
  const sqlClient = getSqlClient();
  const rows = await sqlClient.query(`${cashSessionSelect}
    where bm.user_id = $1 and cs.id = $2
    limit 1`, [userId, cashSessionId]);
  return rows[0] ? mapCashSession(rows[0] as Record<string, unknown>) : null;
}

export type OpenCashResult = { ok: true; id: string } | { ok: false; reason: "NO_BUSINESS" | "ALREADY_OPEN" };

export async function openCashForUser(userId: string, openingAmountCents: number): Promise<OpenCashResult> {
  const sqlClient = getSqlClient();
  const id = crypto.randomUUID();
  const rows = await sqlClient`
    with member as (
      select business_id from business_member
      where user_id = ${userId} and role in ('OWNER', 'ADMIN', 'EMPLOYEE') limit 1
    ), created as (
      insert into cash_session (
        id, business_id, opened_by, opening_amount_cents, expected_cash_cents, status
      )
      select ${id}, business_id, ${userId}, ${openingAmountCents}, ${openingAmountCents}, 'OPEN'
      from member m
      where not exists (
        select 1 from cash_session cs where cs.business_id = m.business_id and cs.status = 'OPEN'
      )
      on conflict do nothing
      returning id
    ) select id from created
  `;
  if (rows[0]) return { ok: true, id: String(rows[0].id) };
  const membership = await sqlClient`select 1 from business_member where user_id = ${userId} limit 1`;
  return membership[0] ? { ok: false, reason: "ALREADY_OPEN" } : { ok: false, reason: "NO_BUSINESS" };
}

export type CloseCashResult =
  | { ok: true; id: string; differenceCents: number }
  | { ok: false; reason: "NOT_FOUND_OR_CLOSED" };

export async function closeCashForUser(
  userId: string,
  cashSessionId: string,
  declaredCashCents: number,
): Promise<CloseCashResult> {
  const sqlClient = getSqlClient();
  const rows = await sqlClient`
    with target as (
      select cs.id, cs.expected_cash_cents
      from cash_session cs
      inner join business_member bm
        on bm.business_id = cs.business_id
       and bm.user_id = ${userId}
       and bm.role in ('OWNER', 'ADMIN', 'EMPLOYEE')
      where cs.id = ${cashSessionId} and cs.status = 'OPEN'
      for update of cs
    ), closed as (
      update cash_session cs
      set status = 'CLOSED', closed_by = ${userId}, closed_at = now(),
          declared_cash_cents = ${declaredCashCents},
          difference_cents = ${declaredCashCents} - t.expected_cash_cents,
          updated_at = now()
      from target t where cs.id = t.id
      returning cs.id, cs.difference_cents
    ) select id, difference_cents from closed
  `;
  const row = rows[0];
  return row
    ? { ok: true, id: String(row.id), differenceCents: Number(row.difference_cents) }
    : { ok: false, reason: "NOT_FOUND_OR_CLOSED" };
}
