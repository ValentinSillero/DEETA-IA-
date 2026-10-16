import "server-only";

import { cache } from "react";

import { getSqlClient } from "@/db";
import type { CustomerMovementType, MemberRole, PaymentMethod } from "@/db/schema";
import type {
  CustomerAdjustmentInput,
  CustomerInput,
  CustomerPaymentInput,
  QuickCustomerInput,
} from "@/lib/customer-validations";

// Todas las consultas parten de business_member: el negocio sale siempre de la
// membresía autenticada y nunca de un identificador enviado por el navegador.

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  balanceCents: number;
  isActive: boolean;
  lastMovementAt: Date | null;
};

export type CustomerFilter = "all" | "debt" | "inactive";

function mapListItem(row: Record<string, unknown>): CustomerListItem {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    balanceCents: Number(row.balance_cents),
    isActive: Boolean(row.is_active),
    lastMovementAt: row.last_movement_at ? new Date(String(row.last_movement_at)) : null,
  };
}

const membershipCached = cache(async (userId: string) => {
  const sql = getSqlClient();
  const rows = await sql`
    select bm.business_id, bm.role, b.timezone
    from business_member bm inner join business b on b.id = bm.business_id
    where bm.user_id = ${userId}
    limit 1
  `;
  return rows[0]
    ? { businessId: String(rows[0].business_id), role: String(rows[0].role) as MemberRole, timezone: String(rows[0].timezone) }
    : null;
});

export function getCustomerContextForUser(userId: string) {
  return membershipCached(userId);
}

export async function getCustomersPageForUser(userId: string, options: { search?: string; filter?: CustomerFilter } = {}) {
  const context = await membershipCached(userId);
  if (!context) return null;
  const sql = getSqlClient();
  const search = options.search?.trim().slice(0, 80) ?? "";
  const pattern = `%${search}%`;
  const filter = options.filter ?? "all";
  // Resumen y lista en dos consultas agregadas: nunca una consulta por cliente.
  const [customerRows, summaryRows] = await Promise.all([
    sql`
      select c.id, c.name, c.phone, c.balance_cents, c.is_active, c.last_movement_at
      from customer c
      where c.business_id = ${context.businessId}
        and (${filter} = 'inactive' and c.is_active = false or ${filter} <> 'inactive' and c.is_active = true)
        and (${filter} <> 'debt' or c.balance_cents > 0)
        and (${search} = '' or c.name ilike ${pattern} or c.phone ilike ${pattern})
      order by (c.balance_cents > 0) desc, c.balance_cents desc, c.name asc
      limit 200
    `,
    sql`
      select
        coalesce(sum(c.balance_cents), 0)::bigint as pending_cents,
        count(*) filter (where c.balance_cents > 0)::int as debtors,
        count(*) filter (where c.is_active)::int as active_customers,
        (select coalesce(sum(-m.amount_cents), 0)
          from customer_account_movement m
          where m.business_id = ${context.businessId}
            and m.type = 'PAYMENT'
            and timezone(${context.timezone}, m.created_at) >= date_trunc('month', timezone(${context.timezone}, now()))
        )::bigint as payments_this_month_cents
      from customer c
      where c.business_id = ${context.businessId}
    `,
  ]);
  const summary = summaryRows[0];
  return {
    role: context.role,
    customers: customerRows.map((row) => mapListItem(row as Record<string, unknown>)),
    summary: {
      pendingCents: Number(summary?.pending_cents ?? 0),
      debtors: Number(summary?.debtors ?? 0),
      activeCustomers: Number(summary?.active_customers ?? 0),
      paymentsThisMonthCents: Number(summary?.payments_this_month_cents ?? 0),
    },
  };
}

// Resumen liviano para Inicio: una sola consulta agregada sobre el saldo materializado.
export async function getCustomerDebtSummaryForUser(userId: string) {
  const sql = getSqlClient();
  const rows = await sql`
    select coalesce(sum(c.balance_cents), 0)::bigint as pending_cents, count(*) filter (where c.balance_cents > 0)::int as debtors
    from customer c
    inner join business_member bm on bm.business_id = c.business_id and bm.user_id = ${userId}
    where c.balance_cents > 0
  `;
  return { pendingCents: Number(rows[0]?.pending_cents ?? 0), debtors: Number(rows[0]?.debtors ?? 0) };
}

export async function searchCustomersForUser(userId: string, query: string) {
  const context = await membershipCached(userId);
  if (!context) return [];
  const sql = getSqlClient();
  const search = query.trim().slice(0, 80);
  const pattern = `%${search}%`;
  const rows = await sql`
    select c.id, c.name, c.phone, c.balance_cents, c.is_active, c.last_movement_at
    from customer c
    where c.business_id = ${context.businessId}
      and c.is_active = true
      and (${search} = '' or c.name ilike ${pattern} or c.phone ilike ${pattern})
    order by c.last_movement_at desc nulls last, c.name asc
    limit 8
  `;
  return rows.map((row) => mapListItem(row as Record<string, unknown>));
}

export type CustomerMovementDto = {
  id: string;
  type: CustomerMovementType;
  amountCents: number;
  balanceAfterCents: number;
  paymentMethod: PaymentMethod | null;
  saleId: string | null;
  note: string | null;
  createdAt: Date;
  createdByName: string;
};

export type CustomerDetail = CustomerListItem & {
  email: string | null;
  document: string | null;
  notes: string | null;
  createdAt: Date;
  movements: CustomerMovementDto[];
  role: MemberRole;
  timezone: string;
};

export async function getCustomerForUser(userId: string, customerId: string): Promise<CustomerDetail | null> {
  const context = await membershipCached(userId);
  if (!context) return null;
  const sql = getSqlClient();
  const [customerRows, movementRows] = await Promise.all([
    sql`
      select c.*
      from customer c
      where c.id = ${customerId} and c.business_id = ${context.businessId}
      limit 1
    `,
    sql`
      select m.id, m.type, m.amount_cents, m.balance_after_cents, m.payment_method,
        m.sale_id, m.note, m.created_at, u.name as created_by_name
      from customer_account_movement m
      inner join "user" u on u.id = m.created_by
      where m.customer_id = ${customerId} and m.business_id = ${context.businessId}
      order by m.created_at desc, m.id desc
      limit 300
    `,
  ]);
  const row = customerRows[0];
  if (!row) return null;
  return {
    ...mapListItem(row as Record<string, unknown>),
    email: row.email ? String(row.email) : null,
    document: row.document ? String(row.document) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: new Date(String(row.created_at)),
    role: context.role,
    timezone: context.timezone,
    movements: movementRows.map((movement) => ({
      id: String(movement.id),
      type: movement.type as CustomerMovementType,
      amountCents: Number(movement.amount_cents),
      balanceAfterCents: Number(movement.balance_after_cents),
      paymentMethod: movement.payment_method ? (movement.payment_method as PaymentMethod) : null,
      saleId: movement.sale_id ? String(movement.sale_id) : null,
      note: movement.note ? String(movement.note) : null,
      createdAt: new Date(String(movement.created_at)),
      createdByName: String(movement.created_by_name),
    })),
  };
}

export async function getActiveCustomerForSaleForUser(userId: string, customerId: string) {
  const context = await membershipCached(userId);
  if (!context) return null;
  const sql = getSqlClient();
  const rows = await sql`
    select c.id, c.name, c.phone, c.balance_cents, c.is_active, c.last_movement_at
    from customer c
    where c.id = ${customerId} and c.business_id = ${context.businessId} and c.is_active = true
    limit 1
  `;
  return rows[0] ? mapListItem(rows[0] as Record<string, unknown>) : null;
}

export async function createCustomerForUser(userId: string, input: CustomerInput | QuickCustomerInput) {
  const sql = getSqlClient();
  const id = crypto.randomUUID();
  const values = { email: null, document: null, notes: null, ...input };
  const rows = await sql`
    insert into customer (id, business_id, name, phone, email, document, notes)
    select ${id}, bm.business_id, ${values.name}, ${values.phone}, ${values.email}, ${values.document}, ${values.notes}
    from business_member bm
    where bm.user_id = ${userId} and bm.role in ('OWNER', 'ADMIN', 'EMPLOYEE')
    limit 1
    returning id, name, phone, balance_cents, is_active, last_movement_at
  `;
  return rows[0] ? mapListItem(rows[0] as Record<string, unknown>) : null;
}

export async function updateCustomerForUser(userId: string, customerId: string, input: CustomerInput) {
  const sql = getSqlClient();
  const rows = await sql`
    update customer c
    set name = ${input.name}, phone = ${input.phone}, email = ${input.email},
        document = ${input.document}, notes = ${input.notes}, updated_at = now()
    from business_member bm
    where c.id = ${customerId}
      and bm.business_id = c.business_id
      and bm.user_id = ${userId}
      and bm.role in ('OWNER', 'ADMIN', 'EMPLOYEE')
    returning c.id
  `;
  return rows.length > 0;
}

export type SetCustomerActiveResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "HAS_DEBT" | "FORBIDDEN" };

export async function setCustomerActiveForUser(userId: string, customerId: string, active: boolean): Promise<SetCustomerActiveResult> {
  const context = await membershipCached(userId);
  if (!context) return { ok: false, reason: "NOT_FOUND" };
  if (context.role !== "OWNER" && context.role !== "ADMIN") return { ok: false, reason: "FORBIDDEN" };
  const sql = getSqlClient();
  // Un cliente con deuda no puede desaparecer de la gestión.
  const rows = await sql`
    update customer c
    set is_active = ${active}, updated_at = now()
    from business_member bm
    where c.id = ${customerId}
      and bm.business_id = c.business_id
      and bm.user_id = ${userId}
      and bm.role in ('OWNER', 'ADMIN')
      and (${active} or c.balance_cents = 0)
    returning c.id
  `;
  if (rows.length > 0) return { ok: true };
  const existing = await getCustomerForUser(userId, customerId);
  if (!existing) return { ok: false, reason: "NOT_FOUND" };
  return { ok: false, reason: "HAS_DEBT" };
}

export type CustomerPaymentResult =
  | { ok: true; movementId: string; balanceCents: number; duplicated: boolean }
  | { ok: false; reason: "NOT_FOUND" | "NO_DEBT" | "EXCEEDS_BALANCE" | "OPEN_CASH_REQUIRED" };

export async function registerCustomerPaymentForUser(userId: string, input: CustomerPaymentInput): Promise<CustomerPaymentResult> {
  const sql = getSqlClient();
  const movementId = crypto.randomUUID();
  const incomeId = crypto.randomUUID();
  // Pago, ingreso, saldo y caja en una sola sentencia. El efectivo exige caja
  // abierta, igual que una venta en efectivo; transferencia y tarjeta no
  // modifican el efectivo esperado.
  const rows = await sql`
    with member as (
      select business_id from business_member
      where user_id = ${userId} and role in ('OWNER', 'ADMIN', 'EMPLOYEE')
      limit 1
    ), target as (
      select c.id, c.business_id, c.balance_cents
      from customer c
      inner join member m on m.business_id = c.business_id
      where c.id = ${input.customerId}
      for update of c
    ), open_cash as (
      select cs.id
      from cash_session cs
      inner join member m on m.business_id = cs.business_id
      where cs.status = 'OPEN'
    ), inserted as (
      insert into customer_account_movement (
        id, business_id, customer_id, type, amount_cents, balance_after_cents,
        payment_method, cash_session_id, note, idempotency_key, created_by
      )
      select
        ${movementId}, t.business_id, t.id, 'PAYMENT', -${input.amountCents}::bigint,
        t.balance_cents - ${input.amountCents}::bigint, ${input.method}::payment_method,
        oc.id, ${input.note}, ${input.idempotencyKey}, ${userId}
      from target t
      left join open_cash oc on true
      where ${input.amountCents}::bigint <= t.balance_cents
        and (${input.method} <> 'CASH' or oc.id is not null)
      on conflict (business_id, idempotency_key) where idempotency_key is not null do nothing
      returning id, business_id, customer_id, amount_cents, balance_after_cents, payment_method, cash_session_id
    ), updated_customer as (
      update customer c
      set balance_cents = i.balance_after_cents, last_movement_at = now(), updated_at = now()
      from inserted i
      where c.id = i.customer_id
      returning c.id
    ), inserted_income as (
      insert into income (id, business_id, cash_session_id, amount_cents, payment_method, source, status)
      select ${incomeId}, i.business_id, i.cash_session_id, -i.amount_cents, i.payment_method, 'CUSTOMER_PAYMENT', 'ACTIVE'
      from inserted i
      returning id
    ), updated_cash as (
      update cash_session cs
      set expected_cash_cents = cs.expected_cash_cents - i.amount_cents, updated_at = now()
      from inserted i
      where cs.id = i.cash_session_id and i.payment_method = 'CASH' and cs.status = 'OPEN'
      returning cs.id
    )
    select i.id, i.balance_after_cents,
      (select count(*) from updated_customer)::int as customer_count,
      (select count(*) from inserted_income)::int as income_count,
      (select count(*) from updated_cash)::int as cash_count
    from inserted i
  `;
  if (rows[0]) return { ok: true, movementId: String(rows[0].id), balanceCents: Number(rows[0].balance_after_cents), duplicated: false };

  // Doble envío: el pago con la misma clave ya existe y no se repite.
  const duplicate = await sql`
    select m.id, c.balance_cents
    from customer_account_movement m
    inner join business_member bm on bm.business_id = m.business_id and bm.user_id = ${userId}
    inner join customer c on c.id = m.customer_id and c.business_id = m.business_id
    where m.idempotency_key = ${input.idempotencyKey}
    limit 1
  `;
  if (duplicate[0]) return { ok: true, movementId: String(duplicate[0].id), balanceCents: Number(duplicate[0].balance_cents), duplicated: true };

  const customer = await getActiveCustomerOrAnyForUser(userId, input.customerId);
  if (!customer) return { ok: false, reason: "NOT_FOUND" };
  if (customer.balanceCents === 0) return { ok: false, reason: "NO_DEBT" };
  if (input.amountCents > customer.balanceCents) return { ok: false, reason: "EXCEEDS_BALANCE" };
  return { ok: false, reason: "OPEN_CASH_REQUIRED" };
}

async function getActiveCustomerOrAnyForUser(userId: string, customerId: string) {
  const sql = getSqlClient();
  const rows = await sql`
    select c.id, c.name, c.phone, c.balance_cents, c.is_active, c.last_movement_at
    from customer c
    inner join business_member bm on bm.business_id = c.business_id and bm.user_id = ${userId}
    where c.id = ${customerId}
    limit 1
  `;
  return rows[0] ? mapListItem(rows[0] as Record<string, unknown>) : null;
}

export type CustomerAdjustmentResult =
  | { ok: true; balanceCents: number }
  | { ok: false; reason: "NOT_FOUND" | "FORBIDDEN" | "NEGATIVE_BALANCE" };

export async function adjustCustomerBalanceForUser(userId: string, input: CustomerAdjustmentInput): Promise<CustomerAdjustmentResult> {
  const context = await membershipCached(userId);
  if (!context) return { ok: false, reason: "NOT_FOUND" };
  if (context.role !== "OWNER" && context.role !== "ADMIN") return { ok: false, reason: "FORBIDDEN" };
  const sql = getSqlClient();
  const signed = input.direction === "INCREASE" ? input.amountCents : -input.amountCents;
  const rows = await sql`
    with member as (
      select business_id from business_member
      where user_id = ${userId} and role in ('OWNER', 'ADMIN')
      limit 1
    ), target as (
      select c.id, c.business_id, c.balance_cents
      from customer c
      inner join member m on m.business_id = c.business_id
      where c.id = ${input.customerId}
      for update of c
    ), inserted as (
      insert into customer_account_movement (
        id, business_id, customer_id, type, amount_cents, balance_after_cents, note, idempotency_key, created_by
      )
      select ${crypto.randomUUID()}, t.business_id, t.id, 'ADJUSTMENT', ${signed}::bigint,
        t.balance_cents + ${signed}::bigint, ${input.reason}, ${input.idempotencyKey}, ${userId}
      from target t
      where t.balance_cents + ${signed}::bigint >= 0
      on conflict (business_id, idempotency_key) where idempotency_key is not null do nothing
      returning customer_id, balance_after_cents
    ), updated_customer as (
      update customer c
      set balance_cents = i.balance_after_cents, last_movement_at = now(), updated_at = now()
      from inserted i
      where c.id = i.customer_id
      returning c.id
    )
    select i.balance_after_cents, (select count(*) from updated_customer)::int as customer_count from inserted i
  `;
  if (rows[0]) return { ok: true, balanceCents: Number(rows[0].balance_after_cents) };
  const customer = await getActiveCustomerOrAnyForUser(userId, input.customerId);
  if (!customer) return { ok: false, reason: "NOT_FOUND" };
  const duplicate = await sql`select 1 from customer_account_movement where business_id = ${context.businessId} and idempotency_key = ${input.idempotencyKey} limit 1`;
  if (duplicate[0]) return { ok: true, balanceCents: customer.balanceCents };
  return { ok: false, reason: "NEGATIVE_BALANCE" };
}
