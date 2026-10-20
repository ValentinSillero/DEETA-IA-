// Carga data/catalogo_base.csv en catalog_product. Idempotente: se puede correr
// las veces que haga falta. Uso: npm run db:seed-catalog
// Toma DATABASE_URL del entorno (o de .env.local, si existe).
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

import { parseCatalogCsv, upsertCatalog } from "../src/db/catalog-seed.ts";

const file = process.argv[2] ?? "data/catalogo_base.csv";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const host = new URL(databaseUrl).hostname;
const { rows, skipped } = parseCatalogCsv(readFileSync(file, "utf8"));
console.log(`Base: ${host}`);
console.log(`Filas válidas: ${rows.length}. Descartadas: ${skipped.length}.`);
for (const skip of skipped.slice(0, 20)) console.log(`  línea ${skip.line} (${skip.barcode || "sin código"}): ${skip.reason}`);

const sql = neon(databaseUrl);
const { processed } = await upsertCatalog(sql, rows);
const [{ total }] = await sql`select count(*)::int as total from catalog_product` as Array<{ total: number }>;
console.log(`Listo: ${processed} productos cargados o actualizados. Total en el catálogo: ${total}.`);
