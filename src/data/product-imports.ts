import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getDb, getSqlClient } from "@/db";
import { activeMembership, productImport, productImportRow } from "@/db/schema";
import { rolesWith } from "@/lib/permissions";
import {
  PRODUCT_IMPORT_LIMITS,
  productImportSummary,
  type ExistingProductStrategy,
  type ImportSourceRow,
  type ProductImportMapping,
  validateProductImportMapping,
  validateProductImportRows,
} from "@/lib/product-imports";

type NewImportInput = {
  originalFilename: string;
  fileType: "CSV" | "XLSX";
  fileSize: number;
  headers: string[];
  rows: string[][];
};

async function managedBusinessForUser(userId: string) {
  const db = getDb();
  const [membership] = await db
    .select({ businessId: activeMembership.businessId })
    .from(activeMembership)
    .where(and(eq(activeMembership.userId, userId), inArray(activeMembership.role, rolesWith("PRODUCT_IMPORT"))))
    .limit(1);
  return membership?.businessId ?? null;
}

export async function createProductImportForUser(userId: string, input: NewImportInput) {
  const businessId = await managedBusinessForUser(userId);
  if (!businessId) return null;
  const importId = crypto.randomUUID();
  const sqlClient = getSqlClient();
  const importRows = input.rows.map((rawValues, index) => ({
    id: crypto.randomUUID(),
    row_number: index + 2,
    raw_values: rawValues,
  }));
  const queries = [
    sqlClient`
      insert into product_import (
        id, business_id, created_by, original_filename, file_type, file_size,
        status, headers, total_rows
      ) values (
        ${importId}, ${businessId}, ${userId}, ${input.originalFilename}, ${input.fileType},
        ${input.fileSize}, 'UPLOADED', ${JSON.stringify(input.headers)}::jsonb, ${importRows.length}
      )
    `,
  ];
  for (let index = 0; index < importRows.length; index += PRODUCT_IMPORT_LIMITS.insertChunkSize) {
    const chunk = importRows.slice(index, index + PRODUCT_IMPORT_LIMITS.insertChunkSize);
    queries.push(sqlClient`
      insert into product_import_row (id, business_id, import_id, row_number, raw_values)
      select row.id, ${businessId}, ${importId}, row.row_number, row.raw_values
      from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb)
        as row(id text, row_number integer, raw_values jsonb)
    `);
  }
  await sqlClient.transaction(queries);
  return { id: importId, businessId };
}

export async function getProductImportForUser(userId: string, importId: string) {
  const db = getDb();
  const [record] = await db
    .select({ productImport, role: activeMembership.role })
    .from(productImport)
    .innerJoin(
      activeMembership,
      and(
        eq(activeMembership.businessId, productImport.businessId),
        eq(activeMembership.userId, userId),
        inArray(activeMembership.role, rolesWith("PRODUCT_IMPORT")),
      ),
    )
    .where(eq(productImport.id, importId))
    .limit(1);
  return record?.productImport ?? null;
}

export async function getProductImportRowsForUser(userId: string, importId: string, limit = PRODUCT_IMPORT_LIMITS.previewRows) {
  const importRecord = await getProductImportForUser(userId, importId);
  if (!importRecord) return null;
  const db = getDb();
  return db
    .select()
    .from(productImportRow)
    .where(and(eq(productImportRow.importId, importId), eq(productImportRow.businessId, importRecord.businessId)))
    .orderBy(
      asc(sql`case ${productImportRow.status} when 'ERROR' then 0 when 'WARNING' then 1 when 'READY' then 2 else 3 end`),
      asc(productImportRow.rowNumber),
    )
    .limit(Math.min(limit, PRODUCT_IMPORT_LIMITS.previewRows));
}

async function allImportRows(importId: string, businessId: string): Promise<ImportSourceRow[]> {
  const db = getDb();
  return db
    .select({
      id: productImportRow.id,
      rowNumber: productImportRow.rowNumber,
      rawValues: productImportRow.rawValues,
      overrides: productImportRow.overrides,
      included: productImportRow.included,
    })
    .from(productImportRow)
    .where(and(eq(productImportRow.importId, importId), eq(productImportRow.businessId, businessId)))
    .orderBy(asc(productImportRow.rowNumber));
}

export async function validateProductImportForUser(
  userId: string,
  importId: string,
  mapping: ProductImportMapping,
  strategy: ExistingProductStrategy,
) {
  const importRecord = await getProductImportForUser(userId, importId);
  if (!importRecord || importRecord.status === "PROCESSING" || importRecord.status === "COMPLETED" || importRecord.status === "CANCELLED") return null;
  const mappingIssues = validateProductImportMapping(importRecord.headers, mapping);
  if (mappingIssues.length > 0) return { ok: false as const, issues: mappingIssues };

  const sourceRows = await allImportRows(importId, importRecord.businessId);
  const initial = validateProductImportRows(sourceRows, mapping, new Map(), strategy);
  const barcodes = [...new Set(initial.flatMap((row) => row.barcode ? [row.barcode] : []))];
  const existing = new Map<string, string>();
  if (barcodes.length > 0) {
    const rows = await getSqlClient()`
      select id, barcode
      from product
      where business_id = ${importRecord.businessId}
        and barcode in (select jsonb_array_elements_text(${JSON.stringify(barcodes)}::jsonb))
    ` as { id: string; barcode: string }[];
    rows.forEach((row) => existing.set(row.barcode, row.id));
  }
  const validated = validateProductImportRows(sourceRows, mapping, existing, strategy);
  const summary = productImportSummary(validated);
  const sqlClient = getSqlClient();
  const queries = [];
  for (let index = 0; index < validated.length; index += PRODUCT_IMPORT_LIMITS.insertChunkSize) {
    const chunk = validated.slice(index, index + PRODUCT_IMPORT_LIMITS.insertChunkSize).map((row) => ({
      id: row.id,
      status: row.status,
      issues: row.issues,
      included: row.included,
      name: row.name,
      description: row.description,
      barcode: row.barcode,
      cost_price_cents: row.costPriceCents,
      sale_price_cents: row.salePriceCents,
      initial_stock: row.initialStock,
      minimum_stock: row.minimumStock,
      existing_product_id: row.existingProductId,
    }));
    queries.push(sqlClient`
      update product_import_row target
      set
        status = source.status::product_import_row_status,
        issues = source.issues,
        included = source.included,
        name = source.name,
        description = source.description,
        barcode = source.barcode,
        cost_price_cents = source.cost_price_cents,
        sale_price_cents = source.sale_price_cents,
        initial_stock = source.initial_stock,
        minimum_stock = source.minimum_stock,
        existing_product_id = source.existing_product_id,
        updated_at = now()
      from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) as source(
        id text,
        status text,
        issues jsonb,
        included boolean,
        name text,
        description text,
        barcode text,
        cost_price_cents bigint,
        sale_price_cents bigint,
        initial_stock integer,
        minimum_stock integer,
        existing_product_id text
      )
      where target.id = source.id
        and target.import_id = ${importId}
        and target.business_id = ${importRecord.businessId}
    `);
  }
  queries.push(sqlClient`
    update product_import
    set
      mapping = ${JSON.stringify(mapping)}::jsonb,
      existing_strategy = ${strategy}::product_import_existing_strategy,
      status = 'READY',
      ready_rows = ${summary.ready},
      warning_rows = ${summary.warning},
      error_rows = ${summary.error},
      skipped_rows = ${summary.skipped},
      updated_at = now()
    where id = ${importId}
      and business_id = ${importRecord.businessId}
  `);
  await sqlClient.transaction(queries);
  return { ok: true as const, summary };
}

export async function updateProductImportRowForUser(
  userId: string,
  importId: string,
  rowId: string,
  values: { overrides?: Record<string, string>; included?: boolean },
) {
  const importRecord = await getProductImportForUser(userId, importId);
  if (!importRecord || importRecord.status !== "READY" || !importRecord.mapping) return null;
  const db = getDb();
  const [updated] = await db
    .update(productImportRow)
    .set({
      ...(values.overrides ? { overrides: values.overrides } : {}),
      ...(typeof values.included === "boolean" ? { included: values.included } : {}),
      updatedAt: new Date(),
    })
    .where(and(
      eq(productImportRow.id, rowId),
      eq(productImportRow.importId, importId),
      eq(productImportRow.businessId, importRecord.businessId),
    ))
    .returning({ id: productImportRow.id });
  if (!updated) return null;
  return validateProductImportForUser(
    userId,
    importId,
    importRecord.mapping as ProductImportMapping,
    importRecord.existingStrategy,
  );
}

export async function cancelProductImportForUser(userId: string, importId: string) {
  const importRecord = await getProductImportForUser(userId, importId);
  if (!importRecord || importRecord.status === "PROCESSING" || importRecord.status === "COMPLETED") return false;
  const sqlClient = getSqlClient();
  await sqlClient.transaction([
    sqlClient`delete from product_import_row where import_id = ${importId} and business_id = ${importRecord.businessId}`,
    sqlClient`
      update product_import
      set status = 'CANCELLED', updated_at = now()
      where id = ${importId} and business_id = ${importRecord.businessId}
    `,
  ]);
  return true;
}

export async function confirmProductImportForUser(userId: string, importId: string) {
  const importRecord = await getProductImportForUser(userId, importId);
  if (!importRecord) return null;
  if (importRecord.status === "COMPLETED") return { alreadyCompleted: true as const, batch: importRecord };
  if (importRecord.status !== "READY" || importRecord.readyRows + importRecord.warningRows < 1) {
    return { unavailable: true as const, batch: importRecord };
  }

  const sqlClient = getSqlClient();
  const results = await sqlClient.transaction([
    sqlClient`
      update product_import i
      set status = 'PROCESSING', updated_at = now()
      where i.id = ${importId}
        and i.business_id = ${importRecord.businessId}
        and i.status = 'READY'
        and exists (
          select 1 from active_membership bm
          where bm.business_id = i.business_id
            and bm.user_id = ${userId}
            and bm.role = any(${rolesWith("PRODUCT_IMPORT")}::member_role[])
        )
      returning id
    `,
    sqlClient`
      update product_import_row r
      set existing_product_id = p.id, updated_at = now()
      from product p, product_import i
      where r.import_id = i.id
        and r.business_id = i.business_id
        and i.id = ${importId}
        and i.business_id = ${importRecord.businessId}
        and i.status = 'PROCESSING'
        and r.status in ('READY', 'WARNING')
        and r.included = true
        and r.barcode is not null
        and p.business_id = r.business_id
        and p.barcode = r.barcode
    `,
    sqlClient`
      insert into product (
        id, business_id, name, description, cost_price_cents, sale_price_cents,
        current_stock, minimum_stock, barcode, is_active
      )
      select
        r.id, r.business_id, r.name, r.description, r.cost_price_cents, r.sale_price_cents,
        r.initial_stock, r.minimum_stock, r.barcode, true
      from product_import_row r
      inner join product_import i on i.id = r.import_id and i.business_id = r.business_id
      where i.id = ${importId}
        and i.business_id = ${importRecord.businessId}
        and i.status = 'PROCESSING'
        and r.status in ('READY', 'WARNING')
        and r.included = true
        and r.existing_product_id is null
        and r.name is not null
        and r.cost_price_cents is not null
        and r.sale_price_cents is not null
        and r.initial_stock is not null
        and r.minimum_stock is not null
      on conflict do nothing
    `,
    sqlClient`
      insert into stock_movement (
        id, business_id, product_id, type, quantity, previous_stock,
        resulting_stock, reason, created_by
      )
      select
        concat('import-initial-', r.id), r.business_id, r.id, 'INITIAL', r.initial_stock,
        0, r.initial_stock, 'Ingreso inicial por importación', ${userId}
      from product_import_row r
      inner join product_import i on i.id = r.import_id and i.business_id = r.business_id
      inner join product p on p.id = r.id and p.business_id = r.business_id
      where i.id = ${importId}
        and i.business_id = ${importRecord.businessId}
        and i.status = 'PROCESSING'
        and r.initial_stock > 0
      on conflict do nothing
    `,
    sqlClient`
      with targets as (
        select
          r.id as row_id,
          p.id as product_id,
          p.business_id,
          p.current_stock as previous_stock,
          r.initial_stock as requested_stock,
          r.cost_price_cents,
          r.sale_price_cents,
          r.minimum_stock,
          i.existing_strategy
        from product_import_row r
        inner join product_import i on i.id = r.import_id and i.business_id = r.business_id
        inner join product p on p.id = r.existing_product_id and p.business_id = r.business_id
        where i.id = ${importId}
          and i.business_id = ${importRecord.businessId}
          and i.status = 'PROCESSING'
          and i.existing_strategy in ('UPDATE_PRICES', 'UPDATE_PRICES_STOCK')
          and r.status in ('READY', 'WARNING')
          and r.included = true
          and p.id <> r.id
        for update of p
      ), updated as (
        update product p
        set
          cost_price_cents = t.cost_price_cents,
          sale_price_cents = t.sale_price_cents,
          minimum_stock = t.minimum_stock,
          current_stock = case when t.existing_strategy = 'UPDATE_PRICES_STOCK' then t.requested_stock else p.current_stock end,
          updated_at = now()
        from targets t
        where p.id = t.product_id and p.business_id = t.business_id
        returning p.id, p.business_id, t.row_id, t.previous_stock, p.current_stock as resulting_stock, t.existing_strategy
      )
      insert into stock_movement (
        id, business_id, product_id, type, quantity, previous_stock,
        resulting_stock, reason, created_by
      )
      select
        concat('import-adjust-', u.row_id), u.business_id, u.id, 'ADJUSTMENT',
        u.resulting_stock - u.previous_stock, u.previous_stock, u.resulting_stock,
        'Ajuste de stock por importación', ${userId}
      from updated u
      where u.existing_strategy = 'UPDATE_PRICES_STOCK'
        and u.resulting_stock <> u.previous_stock
      on conflict do nothing
    `,
    sqlClient`
      update product_import_row r
      set
        status = case
          when p.id = r.id then 'IMPORTED'::product_import_row_status
          when i.existing_strategy = 'SKIP' then 'SKIPPED'::product_import_row_status
          else 'UPDATED'::product_import_row_status
        end,
        existing_product_id = p.id,
        updated_at = now()
      from product_import i
      inner join product p on p.business_id = i.business_id
      where r.import_id = i.id
        and r.business_id = i.business_id
        and i.id = ${importId}
        and i.business_id = ${importRecord.businessId}
        and i.status = 'PROCESSING'
        and r.status in ('READY', 'WARNING')
        and r.included = true
        and (p.id = r.id or (r.barcode is not null and p.barcode = r.barcode))
    `,
    sqlClient`
      update product_import i
      set
        status = 'COMPLETED',
        imported_rows = counts.imported,
        updated_rows = counts.updated,
        skipped_rows = counts.skipped,
        error_rows = counts.errors,
        completed_at = now(),
        updated_at = now()
      from (
        select
          count(*) filter (where status = 'IMPORTED')::int as imported,
          count(*) filter (where status = 'UPDATED')::int as updated,
          count(*) filter (where status = 'SKIPPED')::int as skipped,
          count(*) filter (where status = 'ERROR')::int as errors
        from product_import_row
        where import_id = ${importId} and business_id = ${importRecord.businessId}
      ) counts
      where i.id = ${importId}
        and i.business_id = ${importRecord.businessId}
        and i.status = 'PROCESSING'
      returning i.id
    `,
  ]);
  const claim = results[0] as { id: string }[];
  const finalized = results.at(-1)?.[0] as { id: string } | undefined;
  const current = await getProductImportForUser(userId, importId);
  if (claim.length === 0 || !finalized || current?.status !== "COMPLETED") {
    return current?.status === "COMPLETED"
      ? { alreadyCompleted: true as const, batch: current }
      : { unavailable: true as const, batch: current ?? importRecord };
  }
  return { completed: true as const, batch: current };
}
