import "server-only";

import { and, asc, eq, gt, ilike, inArray, or } from "drizzle-orm";

import { getDb, getSqlClient } from "@/db";
import { activeMembership, product, type PaymentMethod } from "@/db/schema";
import type { CompleteSaleInput } from "@/lib/sale-validations";
import { saleRequestRows, summarizeSalePayments, type SalePaymentLine } from "@/lib/sales";
import { rolesWith } from "@/lib/permissions";

export type SaleProductDto = {
  id: string;
  name: string;
  salePriceCents: number;
  currentStock: number;
  barcode: string | null;
};

// Vender muestra hasta `limit` productos con stock y precio. Con inventarios
// grandes, el resto se encuentra buscando en el servidor (search).
export const SALE_PRODUCTS_LIMIT = 200;

export async function getSaleProductsForUser(userId: string, search = "", limit = SALE_PRODUCTS_LIMIT) {
  const db = getDb();
  const normalizedSearch = search.trim().slice(0, 100);
  return db
    .select({
      id: product.id,
      name: product.name,
      salePriceCents: product.salePriceCents,
      currentStock: product.currentStock,
      barcode: product.barcode,
    })
    .from(product)
    .innerJoin(
      activeMembership,
      and(
        eq(activeMembership.businessId, product.businessId),
        eq(activeMembership.userId, userId),
        inArray(activeMembership.role, rolesWith("SALE_CREATE")),
      ),
    )
    .where(
      and(
        eq(product.isActive, true),
        gt(product.currentStock, 0),
        // Sin precio ($0) no se vende: no aparece en Vender.
        gt(product.salePriceCents, 0),
        normalizedSearch
          ? or(
              ilike(product.name, `%${normalizedSearch}%`),
              ilike(product.barcode, `%${normalizedSearch}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(product.name))
    .limit(limit) satisfies Promise<SaleProductDto[]>;
}

export type CompleteSaleResult =
  | { ok: true; saleId: string; totalCents: number }
  | {
      ok: false;
      reason:
        | "NO_BUSINESS"
        | "OPEN_CASH_REQUIRED"
        | "INSUFFICIENT_PAYMENT"
        | "PAYMENT_MISMATCH"
        | "CUSTOMER_REQUIRED"
        | "INVALID_PRODUCTS_OR_STOCK"
        | "NO_PRICE";
    };

type PaymentRequest = { method: "CASH" | "TRANSFER" | "CARD" | "CREDIT"; amount_cents: number | null; payment_id: string; income_id: string };

// El formato anterior (un medio por el total) se traduce a una sola línea cuyo
// monto es el total calculado en el servidor.
function paymentRequestRows(input: CompleteSaleInput): PaymentRequest[] {
  const lines = input.payments
    ? input.payments.map((line) => ({ method: line.method, amount_cents: line.amountCents as number | null }))
    : [{ method: input.paymentMethod!, amount_cents: null }];
  return lines.map((line) => ({ ...line, payment_id: crypto.randomUUID(), income_id: crypto.randomUUID() }));
}

export async function completeSaleForUser(
  userId: string,
  input: CompleteSaleInput,
): Promise<CompleteSaleResult> {
  const sqlClient = getSqlClient();
  const saleId = crypto.randomUUID();
  const creditMovementId = crypto.randomUUID();
  const requestedItems = saleRequestRows(input.items);
  const requestedPayments = paymentRequestRows(input);
  const customerId = input.customerId ?? null;
  const clientRequestId = input.clientRequestId ?? null;

  // Toda la venta es una sola sentencia: venta, ítems, stock, cobros reales,
  // caja y deuda del cliente se confirman juntos o no se confirma nada.
  const rows = await sqlClient`
    with member as (
      select business_id
      from active_membership
      where user_id = ${userId}
        and role = any(${rolesWith("SALE_CREATE")}::member_role[])
      limit 1
    ), requested as (
      select item_id, movement_id, product_id, quantity
      from jsonb_to_recordset(${JSON.stringify(requestedItems)}::jsonb)
        as item(item_id text, movement_id text, product_id text, quantity integer)
    ), open_cash as (
      select cs.id, cs.business_id
      from cash_session cs
      inner join member m on m.business_id = cs.business_id
      where cs.status = 'OPEN'
      for update of cs
    ), target_customer as (
      select c.id, c.business_id, c.balance_cents
      from customer c
      inner join member m on m.business_id = c.business_id
      where c.id = ${customerId}::text and c.is_active = true
      for update of c
    ), locked_products as (
      select
        p.id as product_id,
        p.business_id,
        p.name,
        p.sale_price_cents,
        p.cost_price_cents,
        p.current_stock,
        r.quantity,
        r.item_id,
        r.movement_id
      from product p
      inner join requested r on r.product_id = p.id
      inner join member m on m.business_id = p.business_id
      -- Precio $0 = "Sin precio": no se puede vender hasta cargarlo.
      where p.is_active = true and p.sale_price_cents > 0
      order by p.id
      for update of p
    ), validation as (
      select
        (select count(*) from requested)::int as requested_count,
        count(*)::int as locked_count,
        coalesce(bool_and(current_stock >= quantity), false) as stock_ok,
        coalesce(sum(sale_price_cents * quantity), 0)::bigint as total_cents
      from locked_products
    ), allocations as (
      select
        pr.method,
        pr.payment_id,
        pr.income_id,
        coalesce(pr.amount_cents, v.total_cents)::bigint as amount_cents
      from jsonb_to_recordset(${JSON.stringify(requestedPayments)}::jsonb)
        as pr(method text, amount_cents bigint, payment_id text, income_id text)
      cross join validation v
    ), payment_summary as (
      select
        count(*)::int as line_count,
        coalesce(sum(amount_cents), 0)::bigint as total_cents,
        coalesce(sum(amount_cents) filter (where method = 'CASH'), 0)::bigint as cash_cents,
        coalesce(sum(amount_cents) filter (where method = 'CREDIT'), 0)::bigint as credit_cents,
        bool_and(amount_cents > 0) as amounts_ok,
        case when count(*) = 1 then max(method) else 'MIXED' end as primary_method
      from allocations
    ), sale_row as (
      insert into sale (
        id, business_id, cash_session_id, customer_id, client_request_id,
        total_cents, payment_method, status, created_by
      )
      select
        ${saleId}, m.business_id, cs.id,
        tc.id,
        ${clientRequestId}::text,
        v.total_cents, ps.primary_method::payment_method, 'COMPLETED', ${userId}
      from member m
      cross join validation v
      cross join payment_summary ps
      left join open_cash cs on cs.business_id = m.business_id
      left join target_customer tc on tc.business_id = m.business_id
      where v.requested_count > 0
        and v.requested_count = v.locked_count
        and v.stock_ok = true
        and v.total_cents > 0
        and ps.amounts_ok = true
        and ps.total_cents = v.total_cents
        and (ps.cash_cents = 0 or cs.id is not null)
        and (ps.cash_cents = 0 or coalesce(${input.receivedCashCents}::bigint, -1) >= ps.cash_cents)
        and (ps.credit_cents = 0 or tc.id is not null)
        and (${customerId}::text is null or tc.id is not null)
      on conflict (business_id, client_request_id) where client_request_id is not null do nothing
      returning id, business_id, cash_session_id, customer_id, total_cents
    ), lines as (
      select
        lp.*,
        (lp.sale_price_cents * lp.quantity)::bigint as subtotal_cents
      from locked_products lp
      where exists (select 1 from sale_row)
    ), inserted_items as (
      insert into sale_item (
        id, business_id, sale_id, product_id, product_name_snapshot,
        quantity, unit_price_cents, unit_cost_cents, subtotal_cents
      )
      select
        l.item_id, s.business_id, s.id, l.product_id, l.name,
        l.quantity, l.sale_price_cents, l.cost_price_cents, l.subtotal_cents
      from lines l
      cross join sale_row s
      returning id
    ), updated_products as (
      update product p
      set current_stock = p.current_stock - l.quantity, updated_at = now()
      from lines l
      where p.id = l.product_id
      returning
        p.id as product_id,
        p.business_id,
        l.movement_id,
        l.quantity,
        p.current_stock + l.quantity as previous_stock,
        p.current_stock as resulting_stock
    ), inserted_movements as (
      insert into stock_movement (
        id, business_id, product_id, type, quantity, previous_stock,
        resulting_stock, reason, created_by
      )
      select
        movement_id, business_id, product_id, 'SALE', -quantity,
        previous_stock, resulting_stock, 'Venta', ${userId}
      from updated_products
      returning id
    ), inserted_payments as (
      insert into sale_payment (id, business_id, sale_id, method, amount_cents)
      select a.payment_id, s.business_id, s.id, a.method::sale_payment_method, a.amount_cents
      from allocations a
      cross join sale_row s
      returning id
    ), inserted_income as (
      -- Solo lo cobrado genera ingreso: el fiado queda en la cuenta del cliente.
      insert into income (
        id, business_id, sale_id, cash_session_id, amount_cents,
        payment_method, source, status
      )
      select
        a.income_id, s.business_id, s.id, s.cash_session_id, a.amount_cents,
        a.method::payment_method, 'SALE', 'ACTIVE'
      from allocations a
      cross join sale_row s
      where a.method <> 'CREDIT'
      returning id
    ), updated_cash as (
      update cash_session cs
      set expected_cash_cents = cs.expected_cash_cents + ps.cash_cents,
          updated_at = now()
      from sale_row s
      cross join payment_summary ps
      where cs.id = s.cash_session_id
        and ps.cash_cents > 0
        and cs.status = 'OPEN'
      returning cs.id
    ), credit_movement as (
      insert into customer_account_movement (
        id, business_id, customer_id, type, amount_cents, balance_after_cents,
        sale_id, created_by
      )
      select
        ${creditMovementId}, s.business_id, tc.id, 'CREDIT_SALE', ps.credit_cents,
        tc.balance_cents + ps.credit_cents, s.id, ${userId}
      from sale_row s
      cross join payment_summary ps
      inner join target_customer tc on tc.id = s.customer_id
      where ps.credit_cents > 0
      returning customer_id, balance_after_cents
    ), updated_customer as (
      update customer c
      set balance_cents = cm.balance_after_cents, last_movement_at = now(), updated_at = now()
      from credit_movement cm
      where c.id = cm.customer_id
      returning c.id
    ), revoked_pairing as (
      update scanner_pairing_session pairing
      set status = 'REVOKED', disconnected_at = now(), updated_at = now()
      from sale_row s
      where pairing.id = ${input.pairingSessionId ?? null}::text
        and pairing.business_id = s.business_id
        and pairing.status in ('WAITING', 'CONNECTED')
      returning pairing.id
    )
    select
      s.id,
      s.total_cents,
      (select count(*) from inserted_items)::int as item_count,
      (select count(*) from inserted_movements)::int as movement_count,
      (select count(*) from inserted_payments)::int as payment_count,
      (select count(*) from inserted_income)::int as income_count,
      (select count(*) from updated_cash)::int as cash_update_count,
      (select count(*) from updated_customer)::int as customer_update_count,
      (select count(*) from revoked_pairing)::int as pairing_update_count
    from sale_row s
  `;

  const completed = rows[0] as { id: string; total_cents: number | string } | undefined;
  if (completed) {
    return { ok: true, saleId: completed.id, totalCents: Number(completed.total_cents) };
  }

  // Doble clic: si la venta con esta clave ya existe, se devuelve la misma.
  if (clientRequestId) {
    const existing = await sqlClient`
      select s.id, s.total_cents
      from sale s
      inner join active_membership bm on bm.business_id = s.business_id and bm.user_id = ${userId}
      where s.client_request_id = ${clientRequestId}
      limit 1
    `;
    if (existing[0]) return { ok: true, saleId: String(existing[0].id), totalCents: Number(existing[0].total_cents) };
  }

  const [membershipRows, openCashRows, productRows, customerRows] = await Promise.all([
    sqlClient`select 1 from active_membership where user_id = ${userId} limit 1`,
    sqlClient`
      select 1
      from cash_session cs
      inner join active_membership bm on bm.business_id = cs.business_id
      where bm.user_id = ${userId} and cs.status = 'OPEN'
      limit 1
    `,
    sqlClient`
      with requested as (
        select product_id, quantity
        from jsonb_to_recordset(${JSON.stringify(input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })))}::jsonb)
          as item(product_id text, quantity integer)
      )
      select p.id, p.current_stock, p.sale_price_cents, r.quantity
      from product p
      inner join active_membership bm on bm.business_id = p.business_id
      inner join requested r on r.product_id = p.id
      where bm.user_id = ${userId}
        and p.is_active = true
    `,
    customerId
      ? sqlClient`
          select 1 from customer c
          inner join active_membership bm on bm.business_id = c.business_id
          where bm.user_id = ${userId} and c.id = ${customerId} and c.is_active = true
          limit 1
        `
      : Promise.resolve([]),
  ]);

  if (membershipRows.length === 0) return { ok: false, reason: "NO_BUSINESS" };
  if (productRows.some((row) => Number(row.sale_price_cents) <= 0)) return { ok: false, reason: "NO_PRICE" };
  const stockByProduct = new Map(
    productRows.map((row) => [String(row.id), Number(row.current_stock)]),
  );
  if (
    input.items.some(
      (item) => !stockByProduct.has(item.productId) || stockByProduct.get(item.productId)! < item.quantity,
    )
  ) {
    return { ok: false, reason: "INVALID_PRODUCTS_OR_STOCK" };
  }
  const totalCents = productRows.reduce((total, row) => total + Number(row.sale_price_cents) * Number(row.quantity), 0);
  const payments = input.payments ?? [{ method: input.paymentMethod!, amountCents: totalCents }];
  const summary = summarizeSalePayments(payments);
  if (summary.totalCents !== totalCents) return { ok: false, reason: "PAYMENT_MISMATCH" };
  if ((summary.creditCents > 0 || customerId) && customerRows.length === 0) return { ok: false, reason: "CUSTOMER_REQUIRED" };
  if (summary.cashCents > 0 && openCashRows.length === 0) return { ok: false, reason: "OPEN_CASH_REQUIRED" };
  return { ok: false, reason: "INSUFFICIENT_PAYMENT" };
}

export type SaleListItem = {
  id: string;
  totalCents: number;
  paymentMethod: PaymentMethod;
  status: "COMPLETED" | "CANCELLED";
  createdAt: Date;
  createdByName: string;
  customerName: string | null;
  itemCount: number;
  unitCount: number;
};

export async function getSalesForUser(userId: string): Promise<SaleListItem[]> {
  const sqlClient = getSqlClient();
  const rows = await sqlClient`
    select
      s.id,
      s.total_cents,
      s.payment_method,
      s.status,
      s.created_at,
      u.name as created_by_name,
      c.name as customer_name,
      count(si.id)::int as item_count,
      coalesce(sum(si.quantity), 0)::int as unit_count
    from sale s
    inner join active_membership bm
      on bm.business_id = s.business_id and bm.user_id = ${userId}
    inner join "user" u on u.id = s.created_by
    left join customer c on c.id = s.customer_id and c.business_id = s.business_id
    left join sale_item si on si.sale_id = s.id and si.business_id = s.business_id
    group by s.id, u.id, c.id
    order by s.created_at desc
    limit 200
  `;

  return rows.map((row) => ({
    id: String(row.id),
    totalCents: Number(row.total_cents),
    paymentMethod: row.payment_method as PaymentMethod,
    status: row.status as SaleListItem["status"],
    createdAt: new Date(String(row.created_at)),
    createdByName: String(row.created_by_name),
    customerName: row.customer_name ? String(row.customer_name) : null,
    itemCount: Number(row.item_count),
    unitCount: Number(row.unit_count),
  }));
}

export type SaleDetail = {
  id: string;
  businessId: string;
  cashSessionId: string | null;
  totalCents: number;
  paymentMethod: PaymentMethod;
  payments: SalePaymentLine[];
  cashCents: number;
  creditCents: number;
  customer: { id: string; name: string } | null;
  status: "COMPLETED" | "CANCELLED";
  createdAt: Date;
  createdByName: string;
  cancelledAt: Date | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
  cashSessionStatus: "OPEN" | "CLOSED" | null;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
  }>;
};

export async function getSaleForUser(userId: string, saleId: string): Promise<SaleDetail | null> {
  const sqlClient = getSqlClient();
  const rows = await sqlClient`
    select
      s.id, s.business_id, s.cash_session_id, s.total_cents, s.payment_method,
      s.status, s.created_at, creator.name as created_by_name,
      s.cancelled_at, canceller.name as cancelled_by_name, s.cancellation_reason,
      cs.status as cash_session_status, c.id as customer_id, c.name as customer_name
    from sale s
    inner join active_membership bm
      on bm.business_id = s.business_id and bm.user_id = ${userId}
    inner join "user" creator on creator.id = s.created_by
    left join "user" canceller on canceller.id = s.cancelled_by
    left join cash_session cs
      on cs.id = s.cash_session_id and cs.business_id = s.business_id
    left join customer c on c.id = s.customer_id and c.business_id = s.business_id
    where s.id = ${saleId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const [itemRows, paymentRows] = await Promise.all([
    sqlClient`
      select si.id, si.product_id, si.product_name_snapshot, si.quantity,
             si.unit_price_cents, si.subtotal_cents
      from sale_item si
      inner join active_membership bm
        on bm.business_id = si.business_id and bm.user_id = ${userId}
      where si.sale_id = ${saleId}
      order by si.created_at, si.id
    `,
    sqlClient`
      select sp.method, sp.amount_cents
      from sale_payment sp
      inner join active_membership bm
        on bm.business_id = sp.business_id and bm.user_id = ${userId}
      where sp.sale_id = ${saleId}
      order by sp.method
    `,
  ]);

  // Ventas anteriores al cobro dividido no tienen líneas: se toma su único medio.
  const payments: SalePaymentLine[] = paymentRows.length > 0
    ? paymentRows.map((payment) => ({ method: payment.method as SalePaymentLine["method"], amountCents: Number(payment.amount_cents) }))
    : [{ method: row.payment_method as SalePaymentLine["method"], amountCents: Number(row.total_cents) }];
  const summary = summarizeSalePayments(payments);

  return {
    id: String(row.id),
    businessId: String(row.business_id),
    cashSessionId: row.cash_session_id ? String(row.cash_session_id) : null,
    totalCents: Number(row.total_cents),
    paymentMethod: row.payment_method as PaymentMethod,
    payments,
    cashCents: summary.cashCents,
    creditCents: summary.creditCents,
    customer: row.customer_id ? { id: String(row.customer_id), name: String(row.customer_name) } : null,
    status: row.status as SaleDetail["status"],
    createdAt: new Date(String(row.created_at)),
    createdByName: String(row.created_by_name),
    cancelledAt: row.cancelled_at ? new Date(String(row.cancelled_at)) : null,
    cancelledByName: row.cancelled_by_name ? String(row.cancelled_by_name) : null,
    cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : null,
    cashSessionStatus: row.cash_session_status as SaleDetail["cashSessionStatus"],
    items: itemRows.map((item) => ({
      id: String(item.id),
      productId: String(item.product_id),
      name: String(item.product_name_snapshot),
      quantity: Number(item.quantity),
      unitPriceCents: Number(item.unit_price_cents),
      subtotalCents: Number(item.subtotal_cents),
    })),
  };
}

export type CancelSaleResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "ALREADY_CANCELLED" | "CASH_SESSION_CLOSED" | "CREDIT_ALREADY_PAID" };

export async function cancelSaleForUser(
  userId: string,
  saleId: string,
  reason: string | null,
): Promise<CancelSaleResult> {
  const sqlClient = getSqlClient();
  const current = await getSaleForUser(userId, saleId);
  if (!current) return { ok: false, reason: "NOT_FOUND" };
  if (current.status === "CANCELLED") return { ok: false, reason: "ALREADY_CANCELLED" };
  if (current.cashCents > 0 && current.cashSessionStatus !== "OPEN") {
    return { ok: false, reason: "CASH_SESSION_CLOSED" };
  }

  const payload = current.items.map((item) => ({
    product_id: item.productId,
    movement_id: crypto.randomUUID(),
  }));
  const reversalMovementId = crypto.randomUUID();

  // La parte fiada se revierte con un movimiento nuevo, nunca borrando el
  // original. Si el cliente ya pagó tanto que su saldo es menor que lo fiado
  // en esta venta, la cancelación se bloquea para no dejar un saldo negativo.
  const rows = await sqlClient`
    with member as (
      select business_id
      from active_membership
      where user_id = ${userId}
        and role = any(${rolesWith("SALE_CANCEL")}::member_role[])
      limit 1
    ), target_sale as (
      select s.*
      from sale s
      inner join member m on m.business_id = s.business_id
      where s.id = ${saleId} and s.status = 'COMPLETED'
      for update of s
    ), sale_amounts as (
      select
        coalesce(sum(sp.amount_cents) filter (where sp.method = 'CASH'),
          case when count(sp.id) = 0 and max(s.payment_method::text) = 'CASH' then max(s.total_cents) else 0 end)::bigint as cash_cents,
        coalesce(sum(sp.amount_cents) filter (where sp.method = 'CREDIT'), 0)::bigint as credit_cents
      from target_sale s
      left join sale_payment sp on sp.sale_id = s.id and sp.business_id = s.business_id
    ), open_cash as (
      select cs.id
      from cash_session cs
      inner join target_sale s on s.cash_session_id = cs.id
      where cs.status = 'OPEN'
      for update of cs
    ), sale_customer as (
      select c.id, c.balance_cents
      from customer c
      inner join target_sale s on s.customer_id = c.id and s.business_id = c.business_id
      for update of c
    ), allowed_sale as (
      select s.*
      from target_sale s
      cross join sale_amounts sa
      where (sa.cash_cents = 0 or exists (select 1 from open_cash))
        and (sa.credit_cents = 0 or exists (select 1 from sale_customer sc where sc.balance_cents >= sa.credit_cents))
    ), movement_ids as (
      select product_id, movement_id
      from jsonb_to_recordset(${JSON.stringify(payload)}::jsonb)
        as movement(product_id text, movement_id text)
    ), sale_lines as (
      select si.product_id, sum(si.quantity)::int as quantity, mi.movement_id
      from sale_item si
      inner join allowed_sale s on s.id = si.sale_id and s.business_id = si.business_id
      inner join movement_ids mi on mi.product_id = si.product_id
      group by si.product_id, mi.movement_id
    ), locked_products as (
      select p.id
      from product p
      inner join sale_lines sl on sl.product_id = p.id
      order by p.id
      for update of p
    ), cancelled_sale as (
      update sale s
      set status = 'CANCELLED', cancelled_by = ${userId}, cancelled_at = now(),
          cancellation_reason = ${reason}, updated_at = now()
      from allowed_sale a
      where s.id = a.id
        and (select count(*) from locked_products) = (select count(*) from sale_lines)
      returning s.id, s.business_id, s.cash_session_id, s.customer_id
    ), restored_products as (
      update product p
      set current_stock = p.current_stock + sl.quantity, updated_at = now()
      from sale_lines sl
      where p.id = sl.product_id and exists (select 1 from cancelled_sale)
      returning
        p.id as product_id, p.business_id, sl.movement_id, sl.quantity,
        p.current_stock - sl.quantity as previous_stock,
        p.current_stock as resulting_stock
    ), return_movements as (
      insert into stock_movement (
        id, business_id, product_id, type, quantity, previous_stock,
        resulting_stock, reason, created_by
      )
      select
        movement_id, business_id, product_id, 'RETURN', quantity,
        previous_stock, resulting_stock, 'Cancelación de venta', ${userId}
      from restored_products
      returning id
    ), reversed_income as (
      update income i
      set status = 'REVERSED', reversed_by = ${userId}, reversed_at = now()
      from cancelled_sale s
      where i.sale_id = s.id and i.business_id = s.business_id and i.status = 'ACTIVE'
      returning i.id
    ), updated_cash as (
      update cash_session cs
      set expected_cash_cents = cs.expected_cash_cents - sa.cash_cents,
          updated_at = now()
      from cancelled_sale s
      cross join sale_amounts sa
      where cs.id = s.cash_session_id
        and sa.cash_cents > 0
        and cs.status = 'OPEN'
      returning cs.id
    ), reversal_movement as (
      insert into customer_account_movement (
        id, business_id, customer_id, type, amount_cents, balance_after_cents,
        sale_id, note, created_by
      )
      select
        ${reversalMovementId}, s.business_id, sc.id, 'SALE_CANCELLATION', -sa.credit_cents,
        sc.balance_cents - sa.credit_cents, s.id, ${reason}, ${userId}
      from cancelled_sale s
      cross join sale_amounts sa
      inner join sale_customer sc on sc.id = s.customer_id
      where sa.credit_cents > 0
      returning customer_id, balance_after_cents
    ), updated_customer as (
      update customer c
      set balance_cents = rm.balance_after_cents, last_movement_at = now(), updated_at = now()
      from reversal_movement rm
      where c.id = rm.customer_id
      returning c.id
    )
    select
      s.id,
      (select count(*) from return_movements)::int as movement_count,
      (select count(*) from reversed_income)::int as income_count,
      (select count(*) from updated_cash)::int as cash_update_count,
      (select count(*) from updated_customer)::int as customer_update_count
    from cancelled_sale s
  `;

  if (rows.length > 0) return { ok: true };
  const refreshed = await getSaleForUser(userId, saleId);
  if (!refreshed) return { ok: false, reason: "NOT_FOUND" };
  if (refreshed.status === "CANCELLED") return { ok: false, reason: "ALREADY_CANCELLED" };
  if (refreshed.creditCents > 0) {
    const balanceRows = await sqlClient`select balance_cents from customer where id = ${refreshed.customer?.id ?? null}::text`;
    if (Number(balanceRows[0]?.balance_cents ?? 0) < refreshed.creditCents) return { ok: false, reason: "CREDIT_ALREADY_PAID" };
  }
  return { ok: false, reason: "CASH_SESSION_CLOSED" };
}

export type TodaySalesSummary = {
  totalCents: number;
  operations: number;
  cashCents: number;
  transferCents: number;
  cardCents: number;
  creditCents: number;
};

export async function getTodaySalesSummaryForUser(userId: string): Promise<TodaySalesSummary> {
  const sqlClient = getSqlClient();
  const rows = await sqlClient`
    with today_sales as (
      select s.id, s.total_cents, s.payment_method
      from sale s
      inner join active_membership bm
        on bm.business_id = s.business_id and bm.user_id = ${userId}
      inner join business b on b.id = s.business_id
      where s.status = 'COMPLETED'
        and timezone(b.timezone, s.created_at)::date = timezone(b.timezone, now())::date
    ), allocations as (
      select sp.method::text as method, sp.amount_cents
      from sale_payment sp inner join today_sales t on t.id = sp.sale_id
      union all
      select t.payment_method::text, t.total_cents
      from today_sales t
      where not exists (select 1 from sale_payment sp where sp.sale_id = t.id)
    )
    select
      (select coalesce(sum(total_cents), 0) from today_sales)::bigint as total_cents,
      (select count(*) from today_sales)::int as operations,
      coalesce(sum(amount_cents) filter (where method = 'CASH'), 0)::bigint as cash_cents,
      coalesce(sum(amount_cents) filter (where method = 'TRANSFER'), 0)::bigint as transfer_cents,
      coalesce(sum(amount_cents) filter (where method = 'CARD'), 0)::bigint as card_cents,
      coalesce(sum(amount_cents) filter (where method = 'CREDIT'), 0)::bigint as credit_cents
    from allocations
  `;
  const row = rows[0];
  return {
    totalCents: Number(row?.total_cents ?? 0),
    operations: Number(row?.operations ?? 0),
    cashCents: Number(row?.cash_cents ?? 0),
    transferCents: Number(row?.transfer_cents ?? 0),
    cardCents: Number(row?.card_cents ?? 0),
    creditCents: Number(row?.credit_cents ?? 0),
  };
}
