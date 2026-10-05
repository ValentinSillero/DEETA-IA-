import "server-only";

import { and, asc, eq, gt, ilike, or } from "drizzle-orm";

import { getDb, getSqlClient } from "@/db";
import { businessMember, product } from "@/db/schema";
import type { CompleteSaleInput } from "@/lib/sale-validations";
import { saleRequestRows } from "@/lib/sales";

export type SaleProductDto = {
  id: string;
  name: string;
  salePriceCents: number;
  currentStock: number;
  barcode: string | null;
};

export async function getSaleProductsForUser(userId: string, search = "") {
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
      businessMember,
      and(
        eq(businessMember.businessId, product.businessId),
        eq(businessMember.userId, userId),
      ),
    )
    .where(
      and(
        eq(product.isActive, true),
        gt(product.currentStock, 0),
        normalizedSearch
          ? or(
              ilike(product.name, `%${normalizedSearch}%`),
              ilike(product.barcode, `%${normalizedSearch}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(product.name))
    .limit(200) satisfies Promise<SaleProductDto[]>;
}

export type CompleteSaleResult =
  | { ok: true; saleId: string; totalCents: number }
  | {
      ok: false;
      reason:
        | "NO_BUSINESS"
        | "OPEN_CASH_REQUIRED"
        | "INSUFFICIENT_PAYMENT"
        | "INVALID_PRODUCTS_OR_STOCK";
    };

export async function completeSaleForUser(
  userId: string,
  input: CompleteSaleInput,
): Promise<CompleteSaleResult> {
  const sqlClient = getSqlClient();
  const saleId = crypto.randomUUID();
  const incomeId = crypto.randomUUID();
  const requestedItems = saleRequestRows(input.items);

  const rows = await sqlClient`
    with member as (
      select business_id
      from business_member
      where user_id = ${userId}
        and role in ('OWNER', 'ADMIN', 'EMPLOYEE')
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
      where p.is_active = true
      order by p.id
      for update of p
    ), validation as (
      select
        (select count(*) from requested)::int as requested_count,
        count(*)::int as locked_count,
        coalesce(bool_and(current_stock >= quantity), false) as stock_ok,
        coalesce(sum(sale_price_cents * quantity), 0)::bigint as total_cents
      from locked_products
    ), sale_row as (
      insert into sale (
        id, business_id, cash_session_id, total_cents, payment_method,
        status, created_by
      )
      select
        ${saleId}, m.business_id, cs.id, v.total_cents, ${input.paymentMethod}::payment_method,
        'COMPLETED', ${userId}
      from member m
      cross join validation v
      left join open_cash cs on cs.business_id = m.business_id
      where v.requested_count > 0
        and v.requested_count = v.locked_count
        and v.stock_ok = true
        and v.total_cents > 0
        and (${input.paymentMethod}::payment_method <> 'CASH' or cs.id is not null)
        and (
          ${input.paymentMethod}::payment_method <> 'CASH'
          or (${input.receivedCashCents}::bigint is not null and ${input.receivedCashCents}::bigint >= v.total_cents)
        )
      returning id, business_id, cash_session_id, total_cents, payment_method
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
    ), inserted_income as (
      insert into income (
        id, business_id, sale_id, cash_session_id, amount_cents,
        payment_method, source, status
      )
      select
        ${incomeId}, business_id, id, cash_session_id, total_cents,
        payment_method, 'SALE', 'ACTIVE'
      from sale_row
      returning id
    ), updated_cash as (
      update cash_session cs
      set expected_cash_cents = cs.expected_cash_cents + s.total_cents,
          updated_at = now()
      from sale_row s
      where cs.id = s.cash_session_id
        and s.payment_method = 'CASH'
        and cs.status = 'OPEN'
      returning cs.id
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
      (select count(*) from inserted_income)::int as income_count,
      (select count(*) from updated_cash)::int as cash_update_count,
      (select count(*) from revoked_pairing)::int as pairing_update_count
    from sale_row s
  `;

  const completed = rows[0] as { id: string; total_cents: number | string } | undefined;
  if (completed) {
    return { ok: true, saleId: completed.id, totalCents: Number(completed.total_cents) };
  }

  const [membershipRows, openCashRows, productRows] = await Promise.all([
    sqlClient`select 1 from business_member where user_id = ${userId} limit 1`,
    sqlClient`
      select 1
      from cash_session cs
      inner join business_member bm on bm.business_id = cs.business_id
      where bm.user_id = ${userId} and cs.status = 'OPEN'
      limit 1
    `,
    sqlClient`
      with requested as (
        select product_id
        from jsonb_to_recordset(${JSON.stringify(input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })))}::jsonb)
          as item(product_id text, quantity integer)
      )
      select p.id, p.current_stock
      from product p
      inner join business_member bm on bm.business_id = p.business_id
      inner join requested r on r.product_id = p.id
      where bm.user_id = ${userId}
        and p.is_active = true
    `,
  ]);

  if (membershipRows.length === 0) return { ok: false, reason: "NO_BUSINESS" };
  if (input.paymentMethod === "CASH" && openCashRows.length === 0) {
    return { ok: false, reason: "OPEN_CASH_REQUIRED" };
  }
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
  return { ok: false, reason: "INSUFFICIENT_PAYMENT" };
}

export type SaleListItem = {
  id: string;
  totalCents: number;
  paymentMethod: "CASH" | "TRANSFER" | "CARD";
  status: "COMPLETED" | "CANCELLED";
  createdAt: Date;
  createdByName: string;
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
      count(si.id)::int as item_count,
      coalesce(sum(si.quantity), 0)::int as unit_count
    from sale s
    inner join business_member bm
      on bm.business_id = s.business_id and bm.user_id = ${userId}
    inner join "user" u on u.id = s.created_by
    left join sale_item si on si.sale_id = s.id and si.business_id = s.business_id
    group by s.id, u.id
    order by s.created_at desc
    limit 200
  `;

  return rows.map((row) => ({
    id: String(row.id),
    totalCents: Number(row.total_cents),
    paymentMethod: row.payment_method as SaleListItem["paymentMethod"],
    status: row.status as SaleListItem["status"],
    createdAt: new Date(String(row.created_at)),
    createdByName: String(row.created_by_name),
    itemCount: Number(row.item_count),
    unitCount: Number(row.unit_count),
  }));
}

export type SaleDetail = {
  id: string;
  businessId: string;
  cashSessionId: string | null;
  totalCents: number;
  paymentMethod: "CASH" | "TRANSFER" | "CARD";
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
      cs.status as cash_session_status
    from sale s
    inner join business_member bm
      on bm.business_id = s.business_id and bm.user_id = ${userId}
    inner join "user" creator on creator.id = s.created_by
    left join "user" canceller on canceller.id = s.cancelled_by
    left join cash_session cs
      on cs.id = s.cash_session_id and cs.business_id = s.business_id
    where s.id = ${saleId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const itemRows = await sqlClient`
    select si.id, si.product_id, si.product_name_snapshot, si.quantity,
           si.unit_price_cents, si.subtotal_cents
    from sale_item si
    inner join business_member bm
      on bm.business_id = si.business_id and bm.user_id = ${userId}
    where si.sale_id = ${saleId}
    order by si.created_at, si.id
  `;

  return {
    id: String(row.id),
    businessId: String(row.business_id),
    cashSessionId: row.cash_session_id ? String(row.cash_session_id) : null,
    totalCents: Number(row.total_cents),
    paymentMethod: row.payment_method as SaleDetail["paymentMethod"],
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
  | { ok: false; reason: "NOT_FOUND" | "ALREADY_CANCELLED" | "CASH_SESSION_CLOSED" };

export async function cancelSaleForUser(
  userId: string,
  saleId: string,
  reason: string | null,
): Promise<CancelSaleResult> {
  const sqlClient = getSqlClient();
  const current = await getSaleForUser(userId, saleId);
  if (!current) return { ok: false, reason: "NOT_FOUND" };
  if (current.status === "CANCELLED") return { ok: false, reason: "ALREADY_CANCELLED" };
  if (current.paymentMethod === "CASH" && current.cashSessionStatus !== "OPEN") {
    return { ok: false, reason: "CASH_SESSION_CLOSED" };
  }

  const payload = current.items.map((item) => ({
    product_id: item.productId,
    movement_id: crypto.randomUUID(),
  }));

  const rows = await sqlClient`
    with member as (
      select business_id
      from business_member
      where user_id = ${userId}
        and role in ('OWNER', 'ADMIN', 'EMPLOYEE')
      limit 1
    ), target_sale as (
      select s.*
      from sale s
      inner join member m on m.business_id = s.business_id
      where s.id = ${saleId} and s.status = 'COMPLETED'
      for update of s
    ), open_cash as (
      select cs.id
      from cash_session cs
      inner join target_sale s on s.cash_session_id = cs.id
      where cs.status = 'OPEN'
      for update of cs
    ), allowed_sale as (
      select s.*
      from target_sale s
      where s.payment_method <> 'CASH'
         or exists (select 1 from open_cash)
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
      returning s.id, s.business_id, s.cash_session_id, s.total_cents, s.payment_method
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
      set expected_cash_cents = cs.expected_cash_cents - s.total_cents,
          updated_at = now()
      from cancelled_sale s
      where cs.id = s.cash_session_id
        and s.payment_method = 'CASH'
        and cs.status = 'OPEN'
      returning cs.id
    )
    select
      s.id,
      (select count(*) from return_movements)::int as movement_count,
      (select count(*) from reversed_income)::int as income_count,
      (select count(*) from updated_cash)::int as cash_update_count
    from cancelled_sale s
  `;

  if (rows.length > 0) return { ok: true };
  const refreshed = await getSaleForUser(userId, saleId);
  if (!refreshed) return { ok: false, reason: "NOT_FOUND" };
  if (refreshed.status === "CANCELLED") return { ok: false, reason: "ALREADY_CANCELLED" };
  return { ok: false, reason: "CASH_SESSION_CLOSED" };
}

export type TodaySalesSummary = {
  totalCents: number;
  operations: number;
  cashCents: number;
  transferCents: number;
  cardCents: number;
};

export async function getTodaySalesSummaryForUser(userId: string): Promise<TodaySalesSummary> {
  const sqlClient = getSqlClient();
  const rows = await sqlClient`
    select
      coalesce(sum(s.total_cents) filter (where s.status = 'COMPLETED'), 0)::bigint as total_cents,
      count(*) filter (where s.status = 'COMPLETED')::int as operations,
      coalesce(sum(s.total_cents) filter (where s.status = 'COMPLETED' and s.payment_method = 'CASH'), 0)::bigint as cash_cents,
      coalesce(sum(s.total_cents) filter (where s.status = 'COMPLETED' and s.payment_method = 'TRANSFER'), 0)::bigint as transfer_cents,
      coalesce(sum(s.total_cents) filter (where s.status = 'COMPLETED' and s.payment_method = 'CARD'), 0)::bigint as card_cents
    from sale s
    inner join business_member bm
      on bm.business_id = s.business_id and bm.user_id = ${userId}
    inner join business b on b.id = s.business_id
    where timezone(b.timezone, s.created_at)::date = timezone(b.timezone, now())::date
  `;
  const row = rows[0];
  return {
    totalCents: Number(row?.total_cents ?? 0),
    operations: Number(row?.operations ?? 0),
    cashCents: Number(row?.cash_cents ?? 0),
    transferCents: Number(row?.transfer_cents ?? 0),
    cardCents: Number(row?.card_cents ?? 0),
  };
}
