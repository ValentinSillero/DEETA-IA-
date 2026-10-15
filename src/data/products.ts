import "server-only";

import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";

import { getDb, getSqlClient } from "@/db";
import {
  businessMember,
  product,
  stockMovement,
  user,
} from "@/db/schema";
import type {
  ProductCreateInput,
  ProductEditInput,
  StockMovementInput,
} from "@/lib/product-validations";

export type ProductFilter = "active" | "low" | "out" | "inactive";

const activeCondition = eq(product.isActive, true);
const lowStockCondition = and(
  eq(product.isActive, true),
  sql`${product.currentStock} > 0`,
  sql`${product.minimumStock} > 0`,
  sql`${product.currentStock} <= ${product.minimumStock}`,
);
const outOfStockCondition = and(eq(product.isActive, true), eq(product.currentStock, 0));

export async function getProductCountsForUser(userId: string) {
  const db = getDb();
  const [counts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${product.isActive} = true)::int`,
      low: sql<number>`count(*) filter (
        where ${product.isActive} = true
          and ${product.currentStock} > 0
          and ${product.minimumStock} > 0
          and ${product.currentStock} <= ${product.minimumStock}
      )::int`,
      out: sql<number>`count(*) filter (
        where ${product.isActive} = true and ${product.currentStock} = 0
      )::int`,
      inactive: sql<number>`count(*) filter (where ${product.isActive} = false)::int`,
    })
    .from(product)
    .innerJoin(
      businessMember,
      and(
        eq(businessMember.businessId, product.businessId),
        eq(businessMember.userId, userId),
      ),
    );

  return counts ?? { active: 0, low: 0, out: 0, inactive: 0 };
}

export async function getProductsForUser(
  userId: string,
  options: { search?: string; filter?: ProductFilter } = {},
) {
  const db = getDb();
  const search = options.search?.trim();
  const filter = options.filter ?? "active";
  const statusCondition =
    filter === "low"
      ? lowStockCondition
      : filter === "out"
        ? outOfStockCondition
        : filter === "inactive"
          ? eq(product.isActive, false)
          : activeCondition;

  return db
    .select({
      id: product.id,
      name: product.name,
      salePriceCents: product.salePriceCents,
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      isActive: product.isActive,
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
        statusCondition,
        search
          ? or(ilike(product.name, `%${search}%`), ilike(product.barcode, `%${search}%`))
          : undefined,
      ),
    )
    .orderBy(
      asc(sql`case
        when ${product.currentStock} = 0 then 0
        when ${product.minimumStock} > 0 and ${product.currentStock} <= ${product.minimumStock} then 1
        else 2
      end`),
      asc(product.currentStock),
      asc(product.name),
    )
    .limit(200);
}

export async function getProductsPageForUser(
  userId: string,
  options: { search?: string; filter?: ProductFilter } = {},
) {
  const sqlClient = getSqlClient();
  const search = options.search?.trim() ?? "";
  const filter = options.filter ?? "active";
  const rows = await sqlClient`
    with member as (
      select business_id, role
      from business_member
      where user_id = ${userId}
      limit 1
    ), scoped_products as (
      select p.*
      from product p
      inner join member m on m.business_id = p.business_id
    ), counts as (
      select
        count(*) filter (where is_active = true)::int as active,
        count(*) filter (
          where is_active = true
            and current_stock > 0
            and minimum_stock > 0
            and current_stock <= minimum_stock
        )::int as low,
        count(*) filter (where is_active = true and current_stock = 0)::int as out,
        count(*) filter (where is_active = false)::int as inactive
      from scoped_products
    ), filtered_products as (
      select
        id, name, sale_price_cents, current_stock, minimum_stock, is_active,
        case
          when current_stock = 0 then 0
          when minimum_stock > 0 and current_stock <= minimum_stock then 1
          else 2
        end as stock_order
      from scoped_products
      where (
        (${filter} = 'active' and is_active = true)
        or (${filter} = 'low' and is_active = true and current_stock > 0 and minimum_stock > 0 and current_stock <= minimum_stock)
        or (${filter} = 'out' and is_active = true and current_stock = 0)
        or (${filter} = 'inactive' and is_active = false)
      )
        and (${search} = '' or name ilike ${`%${search}%`} or barcode ilike ${`%${search}%`})
      order by stock_order, current_stock, name
      limit 200
    )
    select
      m.role,
      c.active,
      c.low,
      c.out,
      c.inactive,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', fp.id,
            'name', fp.name,
            'salePriceCents', fp.sale_price_cents,
            'currentStock', fp.current_stock,
            'minimumStock', fp.minimum_stock,
            'isActive', fp.is_active
          ) order by fp.stock_order, fp.current_stock, fp.name
        ) filter (where fp.id is not null),
        '[]'::jsonb
      ) as products
    from member m
    cross join counts c
    left join filtered_products fp on true
    group by m.role, c.active, c.low, c.out, c.inactive
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    role: row.role as "OWNER" | "ADMIN" | "EMPLOYEE",
    counts: {
      active: Number(row.active),
      low: Number(row.low),
      out: Number(row.out),
      inactive: Number(row.inactive),
    },
    products: (row.products as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      salePriceCents: Number(item.salePriceCents),
      currentStock: Number(item.currentStock),
      minimumStock: Number(item.minimumStock),
      isActive: Boolean(item.isActive),
    })),
  };
}

export async function getProductForUser(userId: string, productId: string) {
  const db = getDb();
  const [record] = await db
    .select({
      product,
      role: businessMember.role,
      membershipUserId: businessMember.userId,
    })
    .from(product)
    .innerJoin(
      businessMember,
      and(
        eq(businessMember.businessId, product.businessId),
        eq(businessMember.userId, userId),
      ),
    )
    .where(eq(product.id, productId))
    .limit(1);

  return record ?? null;
}

export async function getMovementsForUser(userId: string, productId: string) {
  const db = getDb();
  return db
    .select({
      movement: stockMovement,
      createdByName: user.name,
    })
    .from(stockMovement)
    .innerJoin(
      product,
      and(
        eq(product.id, stockMovement.productId),
        eq(product.businessId, stockMovement.businessId),
      ),
    )
    .innerJoin(
      businessMember,
      and(
        eq(businessMember.businessId, stockMovement.businessId),
        eq(businessMember.userId, userId),
      ),
    )
    .innerJoin(user, eq(user.id, stockMovement.createdBy))
    .where(eq(stockMovement.productId, productId))
    .orderBy(desc(stockMovement.createdAt))
    .limit(200);
}

export async function createProductForUser(userId: string, values: ProductCreateInput) {
  const sqlClient = getSqlClient();
  const productId = crypto.randomUUID();
  const movementId = crypto.randomUUID();

  await sqlClient`
    with member as (
      select business_id
      from business_member
      where user_id = ${userId}
        and role in ('OWNER', 'ADMIN')
      limit 1
    ), created_product as (
      insert into product (
        id, business_id, name, description, cost_price_cents, sale_price_cents,
        current_stock, minimum_stock, barcode, is_active
      )
      select
        ${productId}, business_id, ${values.name}, ${values.description},
        ${values.costPriceCents}, ${values.salePriceCents}, ${values.initialStock},
        ${values.minimumStock}, ${values.barcode}, true
      from member
      returning id, business_id, current_stock
    ), created_movement as (
      insert into stock_movement (
        id, business_id, product_id, type, quantity, previous_stock,
        resulting_stock, reason, created_by
      )
      select
        ${movementId}, business_id, id, 'INITIAL', current_stock, 0,
        current_stock, 'Stock inicial', ${userId}
      from created_product
      where current_stock > 0
      returning id
    )
    select created_product.id
    from created_product
    left join created_movement on true
  `;

  const created = await getProductForUser(userId, productId);
  if (!created) throw new Error("PRODUCT_NOT_CREATED");
  return created.product;
}

export async function updateProductForUser(
  userId: string,
  productId: string,
  values: ProductEditInput,
) {
  const db = getDb();
  const [updated] = await db
    .update(product)
    .set({
      name: values.name,
      description: values.description,
      costPriceCents: values.costPriceCents,
      salePriceCents: values.salePriceCents,
      minimumStock: values.minimumStock,
      barcode: values.barcode,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(product.id, productId),
        exists(
          db
            .select({ id: businessMember.id })
            .from(businessMember)
            .where(
              and(
                eq(businessMember.businessId, product.businessId),
                eq(businessMember.userId, userId),
                inArray(businessMember.role, ["OWNER", "ADMIN"]),
              ),
            ),
        ),
      ),
    )
    .returning();

  return updated ?? null;
}

export async function setProductActiveForUser(
  userId: string,
  productId: string,
  isActive: boolean,
) {
  const db = getDb();
  const [updated] = await db
    .update(product)
    .set({ isActive, updatedAt: new Date() })
    .where(
      and(
        eq(product.id, productId),
        exists(
          db
            .select({ id: businessMember.id })
            .from(businessMember)
            .where(
              and(
                eq(businessMember.businessId, product.businessId),
                eq(businessMember.userId, userId),
                inArray(businessMember.role, ["OWNER", "ADMIN"]),
              ),
            ),
        ),
      ),
    )
    .returning();

  return updated ?? null;
}

export type StockUpdateResult =
  | { ok: true; previousStock: number; resultingStock: number; quantity: number }
  | { ok: false; reason: "NOT_FOUND" | "INACTIVE" | "INSUFFICIENT_STOCK" };

export async function createStockMovementForUser(
  userId: string,
  productId: string,
  values: StockMovementInput,
): Promise<StockUpdateResult> {
  const sqlClient = getSqlClient();
  const movementId = crypto.randomUUID();
  const rows = await sqlClient`
    with target as (
      select p.id, p.business_id, p.current_stock
      from product p
      inner join business_member bm
        on bm.business_id = p.business_id
       and bm.user_id = ${userId}
       and bm.role in ('OWNER', 'ADMIN')
      where p.id = ${productId}
        and p.is_active = true
      for update of p
    ), updated as (
      update product p
      set
        current_stock = case
          when ${values.type} = 'IN' then t.current_stock + ${values.amount}
          when ${values.type} = 'OUT' then t.current_stock - ${values.amount}
          else ${values.amount}
        end,
        updated_at = now()
      from target t
      where p.id = t.id
        and (${values.type} <> 'OUT' or t.current_stock >= ${values.amount})
      returning
        p.id,
        p.business_id,
        t.current_stock as previous_stock,
        p.current_stock as resulting_stock
    ), movement as (
      insert into stock_movement (
        id, business_id, product_id, type, quantity, previous_stock,
        resulting_stock, reason, created_by
      )
      select
        ${movementId}, business_id, id, ${values.type},
        resulting_stock - previous_stock, previous_stock, resulting_stock,
        ${values.reason}, ${userId}
      from updated
      returning previous_stock, resulting_stock, quantity
    )
    select previous_stock, resulting_stock, quantity from movement
  `;

  const row = rows[0] as
    | { previous_stock: number; resulting_stock: number; quantity: number }
    | undefined;
  if (row) {
    return {
      ok: true,
      previousStock: Number(row.previous_stock),
      resultingStock: Number(row.resulting_stock),
      quantity: Number(row.quantity),
    };
  }

  const current = await getProductForUser(userId, productId);
  if (!current) return { ok: false, reason: "NOT_FOUND" };
  if (!current.product.isActive) return { ok: false, reason: "INACTIVE" };
  return { ok: false, reason: "INSUFFICIENT_STOCK" };
}
