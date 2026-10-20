import "server-only";

import { unstable_cache } from "next/cache";

import { getSqlClient } from "@/db";
import { businessCategory } from "@/db/schema";
import {
  CATALOG_PAGE_SIZE,
  catalogCategoryPriority,
  catalogSearchTerms,
  type CatalogAddItem,
  type CatalogSearchInput,
} from "@/lib/catalog";
import { rolesWith } from "@/lib/permissions";

// Rendimiento: la base resuelve cualquier búsqueda del catálogo en ~1-2 ms; lo
// que pesa es cada ida y vuelta a Neon. Por eso cada operación es UNA sola
// sentencia que incluye la validación de membresía y permiso (no se confía en
// nada que mande el navegador), y lo global que casi no cambia se cachea.

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

export type CatalogCategory = { name: string; total: number; kioskTotal: number };

export type CatalogSearchResult = {
  items: CatalogItem[];
  total: number;
  page: number;
  pageCount: number;
  kioskOnly: boolean;
  rubro: string;
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

// Orden de categorías por rubro, como JSON para resolverlo dentro de la consulta.
const PRIORITY_BY_RUBRO = JSON.stringify(Object.fromEntries(businessCategory.enumValues.map((value) => [value, catalogCategoryPriority(value)])));

// Nombre del producto creado: nombre + tamaño, sin repetir el tamaño si el nombre
// ya termina con él (misma regla que catalogProductName en src/lib/catalog.ts).
const PRODUCT_NAME_SQL = `left(case
  when c.size is null or lower(c.name) like '%' || lower(c.size) then c.name
  else c.name || ' ' || c.size
end, 160)`;

// Búsqueda paginada en una sola consulta. Devuelve null si la persona no puede
// crear productos en su negocio activo. `kioskOnly` null = según el rubro.
export async function searchCatalogForUser(userId: string, input: CatalogSearchInput & { kioskOnly: boolean | null }): Promise<CatalogSearchResult | null> {
  const terms = catalogSearchTerms(input.query);
  const patterns = terms.map((term) => `%${term}%`);
  const digits = /^[0-9]{3,14}$/.test(input.query.trim()) ? `${input.query.trim()}%` : null;
  const offset = (input.page - 1) * CATALOG_PAGE_SIZE;

  const rows = await getSqlClient().query(
    `with member as (
      select am.business_id, b.category::text as rubro,
        coalesce($6::boolean, b.category = 'KIOSK') as kiosk_only
      from active_membership am
      inner join business b on b.id = am.business_id
      where am.user_id = $1 and am.role = any($2::member_role[])
      limit 1
    ), priority as (
      select value as category, ordinality
      from member, jsonb_array_elements_text($7::jsonb -> member.rubro) with ordinality
    )
    select member.kiosk_only, member.rubro, results.*
    from member
    left join lateral (
      select
        c.barcode, c.name, c.size, c.brand, c.category, c.needs_review, c.is_kiosk,
        exists (select 1 from product p where p.business_id = member.business_id and p.barcode = c.barcode) as owned,
        count(*) over () as total
      from catalog_product c
      left join priority on priority.category = c.category
      where (
          cardinality($3::text[]) = 0
          or lower(c.name || ' ' || coalesce(c.brand, '') || ' ' || coalesce(c.size, '')) like all ($3::text[])
          or ($4::text is not null and c.barcode like $4)
        )
        and ($5::text is null or c.category = $5)
        and (not member.kiosk_only or c.is_kiosk)
      order by coalesce(priority.ordinality, 999), c.category, c.needs_review, lower(c.name)
      limit ${CATALOG_PAGE_SIZE} offset ${offset}
    ) results on true`,
    [userId, rolesWith("PRODUCT_CREATE"), patterns, digits, input.category, input.kioskOnly, PRIORITY_BY_RUBRO],
  ) as Array<Record<string, unknown>>;

  if (rows.length === 0) return null;
  const found = rows.filter((row) => row.barcode !== null);
  const total = found[0] ? Number(found[0].total) : 0;
  return {
    items: found.map(toItem),
    total,
    page: input.page,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
    kioskOnly: Boolean(rows[0].kiosk_only),
    rubro: String(rows[0].rubro),
  };
}

// Categorías con su cantidad: globales y casi fijas, se cachean un día. No
// dependen de ningún negocio, así que compartir la caché no expone datos privados.
export const getCatalogCategories = unstable_cache(async (): Promise<CatalogCategory[]> => {
  const rows = await getSqlClient()`
    select category, count(*)::int as total, count(*) filter (where is_kiosk)::int as kiosk_total
    from catalog_product
    group by category
  `;
  return rows.map((row) => ({ name: String(row.category), total: Number(row.total), kioskTotal: Number(row.kiosk_total) }));
}, ["catalog-categories-v1"], { revalidate: 86_400, tags: ["catalog"] });

export type CatalogSuggestion = { barcode: string; name: string; needsReview: boolean; canAdd: boolean };

// Escáner: el código no está en el negocio pero sí en el catálogo. Una sola
// consulta: busca por clave primaria y verifica, dentro del negocio activo, que
// no lo tenga y si el rol puede crear productos.
export async function catalogSuggestionForUser(userId: string, barcode: string): Promise<CatalogSuggestion | null> {
  if (!/^[0-9]{8,14}$/.test(barcode)) return null;
  const rows = await getSqlClient().query(
    `with member as (
      select business_id, role = any($3::member_role[]) as can_add
      from active_membership
      where user_id = $1
      limit 1
    )
    select ${PRODUCT_NAME_SQL} as name, c.barcode, c.needs_review, member.can_add
    from catalog_product c
    cross join member
    where c.barcode = $2
      and not exists (select 1 from product p where p.business_id = member.business_id and p.barcode = c.barcode)`,
    [userId, barcode, rolesWith("PRODUCT_CREATE")],
  ) as Array<Record<string, unknown>>;
  const row = rows[0];
  return row ? { barcode: String(row.barcode), name: String(row.name), needsReview: Boolean(row.needs_review), canAdd: Boolean(row.can_add) } : null;
}

export type AddCatalogResult =
  | { ok: true; created: number; skipped: string[] }
  | { ok: false; reason: "FORBIDDEN" };

// Alta en lote en una sola sentencia: valida membresía y permiso, toma nombre y
// categoría del catálogo y crea cada producto con su movimiento de stock
// inicial. Los códigos que el negocio ya tiene se saltean (índice único por
// negocio y código), así que repetir la operación no duplica nada.
export async function addCatalogProductsForUser(userId: string, items: CatalogAddItem[]): Promise<AddCatalogResult> {
  const unique = [...new Map(items.map((item) => [item.barcode, item])).values()];
  const rows = await getSqlClient().query(
    `with member as (
      select business_id
      from active_membership
      where user_id = $1 and role = any($2::member_role[])
      limit 1
    ), input as (
      select *
      from unnest($3::text[], $4::bigint[], $5::bigint[], $6::integer[], $7::integer[])
        as i(barcode, sale_price_cents, cost_price_cents, initial_stock, minimum_stock)
    ), source as (
      select i.*, ${PRODUCT_NAME_SQL} as name, c.category
      from input i
      inner join catalog_product c on c.barcode = i.barcode
    ), created_products as (
      insert into product (
        id, business_id, name, cost_price_cents, sale_price_cents,
        current_stock, minimum_stock, barcode, category, is_active
      )
      select
        gen_random_uuid()::text, member.business_id, s.name, s.cost_price_cents, s.sale_price_cents,
        s.initial_stock, s.minimum_stock, s.barcode, s.category, true
      from source s
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
        current_stock, 'Stock inicial (catálogo)', $1
      from created_products
      where current_stock > 0
      returning id
    )
    select
      (select count(*) from member)::int as members,
      coalesce((select array_agg(barcode) from created_products), '{}') as created,
      (select count(*) from created_movements)::int as movements`,
    [
      userId,
      rolesWith("PRODUCT_CREATE"),
      unique.map((item) => item.barcode),
      unique.map((item) => item.salePriceCents),
      unique.map((item) => item.costPriceCents),
      unique.map((item) => item.initialStock),
      unique.map((item) => item.minimumStock),
    ],
  ) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row || Number(row.members) === 0) return { ok: false, reason: "FORBIDDEN" };
  const created = new Set((row.created as string[]) ?? []);
  return { ok: true, created: created.size, skipped: unique.map((item) => item.barcode).filter((barcode) => !created.has(barcode)) };
}
