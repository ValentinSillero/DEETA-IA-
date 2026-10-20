import "server-only";

import { getSqlClient } from "@/db";
import type { businessCategory } from "@/db/schema";
import {
  CATALOG_PAGE_SIZE,
  catalogCategoryPriority,
  catalogProductName,
  catalogSearchTerms,
  type CatalogAddItem,
  type CatalogSearchInput,
} from "@/lib/catalog";
import { rolesWith } from "@/lib/permissions";

type BusinessCategory = (typeof businessCategory.enumValues)[number];

export type CatalogItem = {
  barcode: string;
  name: string;
  size: string | null;
  brand: string | null;
  category: string;
  needsReview: boolean;
  isKiosk: boolean;
  owned: boolean;
};

function toItem(row: Record<string, unknown>): CatalogItem {
  return {
    barcode: String(row.barcode),
    name: String(row.name),
    size: row.size ? String(row.size) : null,
    brand: row.brand ? String(row.brand) : null,
    category: String(row.category),
    needsReview: Boolean(row.needs_review),
    isKiosk: Boolean(row.is_kiosk),
    owned: Boolean(row.owned),
  };
}

// Negocio activo de quien puede crear productos. El negocio sale siempre de la
// membresía en la base, nunca del navegador.
async function catalogContext(userId: string) {
  const rows = await getSqlClient()`
    select am.business_id, b.category
    from active_membership am
    inner join business b on b.id = am.business_id
    where am.user_id = ${userId}
      and am.role = any(${rolesWith("PRODUCT_CREATE")}::member_role[])
    limit 1
  `;
  const row = rows[0];
  return row ? { businessId: String(row.business_id), businessCategory: String(row.category) as BusinessCategory } : null;
}

// Búsqueda paginada en el servidor: el catálogo nunca viaja entero al navegador.
// `owned` marca lo que el negocio ya tiene con el mismo código de barras.
export async function searchCatalogForUser(userId: string, input: CatalogSearchInput) {
  const context = await catalogContext(userId);
  if (!context) return null;
  const sql = getSqlClient();
  const priority = catalogCategoryPriority(context.businessCategory);
  const terms = catalogSearchTerms(input.query);
  const patterns = terms.map((term) => `%${term}%`);
  const digits = /^[0-9]{3,14}$/.test(input.query.trim()) ? `${input.query.trim()}%` : null;
  const offset = (input.page - 1) * CATALOG_PAGE_SIZE;

  const [rows, categories] = await Promise.all([
    sql`
      select
        c.barcode, c.name, c.size, c.brand, c.category, c.needs_review, c.is_kiosk,
        exists (
          select 1 from product p
          where p.business_id = ${context.businessId} and p.barcode = c.barcode
        ) as owned,
        count(*) over () as total
      from catalog_product c
      where (
          cardinality(${patterns}::text[]) = 0
          or lower(c.name || ' ' || coalesce(c.brand, '') || ' ' || coalesce(c.size, '')) like all (${patterns}::text[])
          or (${digits}::text is not null and c.barcode like ${digits})
        )
        and (${input.category}::text is null or c.category = ${input.category})
        and (not ${input.kioskOnly} or c.is_kiosk)
      order by
        coalesce(array_position(${priority}::text[], c.category), 999),
        c.category,
        c.needs_review,
        lower(c.name)
      limit ${CATALOG_PAGE_SIZE} offset ${offset}
    `,
    sql`
      select category, count(*)::int as total
      from catalog_product
      where (not ${input.kioskOnly} or is_kiosk)
      group by category
      order by coalesce(array_position(${priority}::text[], category), 999), category
    `,
  ]);

  const total = rows[0] ? Number(rows[0].total) : 0;
  return {
    items: rows.map(toItem),
    total,
    page: input.page,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
    categories: categories.map((row) => ({ name: String(row.category), total: Number(row.total) })),
    businessCategory: context.businessCategory,
  };
}

// Productos elegidos, para el paso de confirmación.
export async function getCatalogSelectionForUser(userId: string, barcodes: string[]) {
  const context = await catalogContext(userId);
  if (!context) return null;
  const unique = [...new Set(barcodes)].filter((barcode) => /^[0-9]{8,14}$/.test(barcode)).slice(0, 50);
  if (unique.length === 0) return [];
  const rows = await getSqlClient()`
    select
      c.barcode, c.name, c.size, c.brand, c.category, c.needs_review, c.is_kiosk,
      exists (select 1 from product p where p.business_id = ${context.businessId} and p.barcode = c.barcode) as owned
    from catalog_product c
    where c.barcode = any(${unique}::text[])
    order by array_position(${unique}::text[], c.barcode)
  `;
  return rows.map(toItem);
}

// Lectura global por código: la usa el escáner cuando el negocio no tiene el producto.
export async function findCatalogProductByBarcode(barcode: string) {
  if (!/^[0-9]{8,14}$/.test(barcode)) return null;
  const rows = await getSqlClient()`
    select barcode, name, size, brand, category, needs_review, is_kiosk, false as owned
    from catalog_product
    where barcode = ${barcode}
    limit 1
  `;
  return rows[0] ? toItem(rows[0]) : null;
}

export type CatalogSuggestion = { barcode: string; name: string; needsReview: boolean; canAdd: boolean };

// Escáner: el código no está en el negocio pero sí en el catálogo. `canAdd`
// dice si el rol puede crear productos; el alta igual se valida al guardar.
export async function catalogSuggestionForUser(userId: string, barcode: string): Promise<CatalogSuggestion | null> {
  const item = await findCatalogProductByBarcode(barcode);
  if (!item) return null;
  const rows = await getSqlClient()`
    select exists (
      select 1 from product p
      inner join active_membership am on am.business_id = p.business_id
      where am.user_id = ${userId} and p.barcode = ${barcode}
    ) as owned,
    exists (
      select 1 from active_membership
      where user_id = ${userId} and role = any(${rolesWith("PRODUCT_CREATE")}::member_role[])
    ) as can_add
  `;
  if (rows[0]?.owned) return null;
  return { barcode: item.barcode, name: catalogProductName(item.name, item.size), needsReview: item.needsReview, canAdd: Boolean(rows[0]?.can_add) };
}

export type AddCatalogResult =
  | { ok: true; created: number; skipped: string[] }
  | { ok: false; reason: "FORBIDDEN" };

// Alta en lote en una sola sentencia: crea cada producto con su movimiento de
// stock inicial. Los códigos que el negocio ya tiene se saltean (índice único
// por negocio y código), así que repetir la operación no duplica nada.
export async function addCatalogProductsForUser(userId: string, items: CatalogAddItem[]): Promise<AddCatalogResult> {
  const context = await catalogContext(userId);
  if (!context) return { ok: false, reason: "FORBIDDEN" };
  const sql = getSqlClient();

  const byBarcode = new Map(items.map((item) => [item.barcode, item]));
  const catalogRows = await sql`
    select barcode, name, size, category
    from catalog_product
    where barcode = any(${[...byBarcode.keys()]}::text[])
  `;
  const rows = catalogRows.map((row) => {
    const item = byBarcode.get(String(row.barcode))!;
    return { ...item, name: catalogProductName(String(row.name), row.size ? String(row.size) : null), category: String(row.category) };
  });
  const notInCatalog = [...byBarcode.keys()].filter((barcode) => !rows.some((row) => row.barcode === barcode));
  if (rows.length === 0) return { ok: true, created: 0, skipped: notInCatalog };

  const result = await sql`
    with member as (
      select business_id
      from active_membership
      where user_id = ${userId}
        and business_id = ${context.businessId}
        and role = any(${rolesWith("PRODUCT_CREATE")}::member_role[])
      limit 1
    ), input as (
      select *
      from unnest(
        ${rows.map((row) => row.barcode)}::text[],
        ${rows.map((row) => row.name)}::text[],
        ${rows.map((row) => row.category)}::text[],
        ${rows.map((row) => row.salePriceCents)}::bigint[],
        ${rows.map((row) => row.costPriceCents)}::bigint[],
        ${rows.map((row) => row.initialStock)}::integer[],
        ${rows.map((row) => row.minimumStock)}::integer[]
      ) as i(barcode, name, category, sale_price_cents, cost_price_cents, initial_stock, minimum_stock)
    ), created_products as (
      insert into product (
        id, business_id, name, cost_price_cents, sale_price_cents,
        current_stock, minimum_stock, barcode, category, is_active
      )
      select
        gen_random_uuid()::text, member.business_id, i.name, i.cost_price_cents, i.sale_price_cents,
        i.initial_stock, i.minimum_stock, i.barcode, i.category, true
      from input i
      cross join member
      on conflict (business_id, barcode) where barcode is not null do nothing
      returning id, business_id, current_stock, barcode
    ), created_movements as (
      insert into stock_movement (
        id, business_id, product_id, type, quantity, previous_stock,
        resulting_stock, reason, created_by
      )
      select
        gen_random_uuid()::text, business_id, id, 'INITIAL', current_stock, 0,
        current_stock, 'Stock inicial (catálogo)', ${userId}
      from created_products
      where current_stock > 0
      returning id
    )
    select
      (select count(*) from member)::int as members,
      coalesce((select array_agg(barcode) from created_products), '{}') as created,
      (select count(*) from created_movements)::int as movements
  `;
  const row = result[0];
  if (!row || Number(row.members) === 0) return { ok: false, reason: "FORBIDDEN" };
  const created = new Set((row.created as string[]) ?? []);
  const skipped = [...rows.map((item) => item.barcode).filter((barcode) => !created.has(barcode)), ...notInCatalog];
  return { ok: true, created: created.size, skipped };
}
