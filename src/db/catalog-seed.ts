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

// Reglas de relevancia (data/catalogo_relevancia.csv): marcas comunes con su
// puntaje. Se mantienen como datos, sin tocar componentes ni consultas.
export type CatalogRelevanceRule = { value: string; points: number };
// Exclusiones (data/catalogo_exclusiones.csv): código y motivo.
export type CatalogExclusion = { barcode: string; reason: string };

export function normalizeCatalogText(value: string | null | undefined) {
  return ` ${(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

export function parseRelevanceRules(content: string): CatalogRelevanceRule[] {
  const records = parse(content, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as Array<Record<string, string>>;
  return records
    .filter((record) => record.tipo === "marca" && record.valor && Number.isFinite(Number(record.puntos)))
    .map((record) => ({ value: normalizeCatalogText(record.valor), points: Math.max(0, Math.min(100, Number(record.puntos))) }));
}

export function parseExclusions(content: string): CatalogExclusion[] {
  const records = parse(content, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as Array<Record<string, string>>;
  return records.filter((record) => BARCODE.test(record.barcode ?? "")).map((record) => ({ barcode: record.barcode, reason: record.reason || "Excluido del catálogo" }));
}

// 0–100: la marca común más fuerte que aparece en la marca o en el nombre,
// más un poco por venir de una lista de distribuidora, estar revisado y tener tamaño.
export function catalogRelevance(row: CatalogSeedRow, rules: CatalogRelevanceRule[]) {
  const brand = normalizeCatalogText(row.brand);
  const name = normalizeCatalogText(row.name);
  const brandPoints = rules.reduce((best, rule) => (brand.includes(rule.value) || name.includes(rule.value)) && rule.points > best ? rule.points : best, 0);
  const bonus = (row.source.includes("distribuidora") ? 15 : 0) + (row.needsReview ? 0 : 10) + (row.size ? 5 : 0);
  return Math.min(100, brandPoints + bonus);
}

// Cliente mínimo: el `neon()` de @neondatabase/serverless cumple esta forma.
export type CatalogSqlClient = { query: (text: string, params?: unknown[]) => Promise<unknown> };

// Upsert por código de barras, en lotes. Correrlo de nuevo actualiza, no duplica.
// La relevancia se recalcula y las exclusiones salen del archivo: un código que
// sale de la lista vuelve a mostrarse (no se borra nada).
export async function upsertCatalog(
  sql: CatalogSqlClient,
  rows: CatalogSeedRow[],
  options: { rules?: CatalogRelevanceRule[]; exclusions?: CatalogExclusion[]; batchSize?: number } = {},
) {
  const rules = options.rules ?? [];
  const excluded = new Map((options.exclusions ?? []).map((item) => [item.barcode, item.reason]));
  const batchSize = options.batchSize ?? 500;
  let processed = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    await sql.query(
      `insert into catalog_product (barcode, name, size, category, brand, is_kiosk, needs_review, source, relevance, excluded_at, excluded_reason, updated_at)
       select barcode, name, size, category, brand, is_kiosk, needs_review, source, relevance,
         case when excluded_reason is null then null else now() end, excluded_reason, now()
       from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::boolean[], $7::boolean[], $8::text[], $9::smallint[], $10::text[])
         as input(barcode, name, size, category, brand, is_kiosk, needs_review, source, relevance, excluded_reason)
       on conflict (barcode) do update set
         name = excluded.name,
         size = excluded.size,
         category = excluded.category,
         brand = excluded.brand,
         is_kiosk = excluded.is_kiosk,
         needs_review = excluded.needs_review,
         source = excluded.source,
         relevance = excluded.relevance,
         excluded_at = case when excluded.excluded_reason is null then null else coalesce(catalog_product.excluded_at, now()) end,
         excluded_reason = excluded.excluded_reason,
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
        batch.map((row) => catalogRelevance(row, rules)),
        batch.map((row) => excluded.get(row.barcode) ?? null),
      ],
    );
    processed += batch.length;
  }
  return { processed, excluded: rows.filter((row) => excluded.has(row.barcode)).length };
}