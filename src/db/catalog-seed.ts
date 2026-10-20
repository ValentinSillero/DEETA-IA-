// Carga del catálogo sugerido (tabla global catalog_product) desde el CSV.
// Sin alias "@/": lo usa también scripts/seed-catalog.ts, que corre con Node.
import { parse } from "csv-parse/sync";

export type CatalogSeedRow = {
  barcode: string;
  name: string;
  size: string | null;
  category: string;
  brand: string | null;
  isKiosk: boolean;
  needsReview: boolean;
  source: string;
};

export type CatalogSeedSkip = { line: number; barcode: string; reason: string };

const BARCODE = /^[0-9]{8,14}$/;

function clean(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return text ? text.slice(0, max) : null;
}

// Valida y normaliza el CSV. Las filas inválidas o repetidas se informan y no se cargan.
export function parseCatalogCsv(content: string) {
  const records = parse(content, { columns: true, skip_empty_lines: true, bom: true, trim: false }) as Array<Record<string, string>>;
  const rows: CatalogSeedRow[] = [];
  const skipped: CatalogSeedSkip[] = [];
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const line = index + 2;
    const barcode = (record.barcode ?? "").trim();
    const name = clean(record.name, 160);
    const category = clean(record.category, 80);
    if (!BARCODE.test(barcode)) return skipped.push({ line, barcode, reason: "Código de barras inválido" });
    if (!name || name.length < 2) return skipped.push({ line, barcode, reason: "Falta el nombre" });
    if (!category) return skipped.push({ line, barcode, reason: "Falta la categoría" });
    if (seen.has(barcode)) return skipped.push({ line, barcode, reason: "Código repetido en el archivo" });
    seen.add(barcode);
    rows.push({
      barcode,
      name,
      size: clean(record.size, 40),
      category,
      brand: clean(record.brand, 80),
      isKiosk: record.kiosk?.trim() === "1",
      needsReview: record.needs_review?.trim() === "1",
      source: clean(record.source, 40) ?? "manual",
    });
  });
  return { rows, skipped };
}

// Cliente mínimo: el `neon()` de @neondatabase/serverless cumple esta forma.
export type CatalogSqlClient = { query: (text: string, params?: unknown[]) => Promise<unknown> };

// Upsert por código de barras, en lotes. Correrlo de nuevo actualiza, no duplica.
export async function upsertCatalog(sql: CatalogSqlClient, rows: CatalogSeedRow[], batchSize = 500) {
  let processed = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    await sql.query(
      `insert into catalog_product (barcode, name, size, category, brand, is_kiosk, needs_review, source, updated_at)
       select barcode, name, size, category, brand, is_kiosk, needs_review, source, now()
       from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::boolean[], $7::boolean[], $8::text[])
         as input(barcode, name, size, category, brand, is_kiosk, needs_review, source)
       on conflict (barcode) do update set
         name = excluded.name,
         size = excluded.size,
         category = excluded.category,
         brand = excluded.brand,
         is_kiosk = excluded.is_kiosk,
         needs_review = excluded.needs_review,
         source = excluded.source,
         updated_at = now()`,
      [
        batch.map((row) => row.barcode),
        batch.map((row) => row.name),
        batch.map((row) => row.size),
        batch.map((row) => row.category),
        batch.map((row) => row.brand),
        batch.map((row) => row.isKiosk),
        batch.map((row) => row.needsReview),
        batch.map((row) => row.source),
      ],
    );
    processed += batch.length;
  }
  return { processed };
}
