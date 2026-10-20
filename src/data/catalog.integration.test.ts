import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseCatalogCsv, upsertCatalog } from "@/db/catalog-seed";

try { nextEnv.processEnv([{ path: ".env.local", contents: readFileSync(".env.local", "utf8"), env: {} }], process.cwd(), undefined, true); } catch { /* Opt-in. */ }
const databaseUrl = process.env.DATABASE_URL;
const expectedTestHost = process.env.DEETA_TEST_DATABASE_HOST;
const requested = process.env.RUN_DB_TESTS === "1";
const databaseHost = (() => {
  try { return databaseUrl ? new URL(databaseUrl).hostname : null; } catch { return null; }
})();
const isolated = Boolean(
  databaseHost
  && expectedTestHost
  && databaseHost === expectedTestHost
  && process.env.NEON_BRANCH
  && !["main", "production", "prod"].includes(process.env.NEON_BRANCH.toLowerCase())
  && !databaseHost.toLowerCase().includes("main"),
);
if (requested && !isolated) {
  throw new Error("Pruebas de base bloqueadas: configurá una rama Neon no productiva y DEETA_TEST_DATABASE_HOST con su host exacto.");
}
const enabled = requested && isolated;
const suite = enabled ? describe : describe.skip;

// Códigos de prueba únicos por corrida (13 dígitos, prefijo 20: uso interno).
const run = String(Date.now()).slice(-8);
const code = (index: number) => `20${run}${String(index).padStart(3, "0")}`;
const uid = crypto.randomUUID();
const ids = {
  ownerA: `cat-owner-a-${uid}`, sellerA: `cat-seller-a-${uid}`, ownerB: `cat-owner-b-${uid}`,
  businessA: `cat-business-a-${uid}`, businessB: `cat-business-b-${uid}`,
  existingA: crypto.randomUUID(), existingB: crypto.randomUUID(),
};
const csv = [
  "barcode,name,size,category,brand,kiosk,needs_review,source",
  `${code(1)},Alfajor de prueba ${run},60 g,Alfajores,Marca Prueba,1,0,test`,
  `${code(2)},Gaseosa de prueba ${run},2 L,Bebidas,Marca Prueba,1,1,test`,
  `${code(3)},Fideos de prueba ${run},500 g,Fideos y arroz,Otra Marca,0,0,test`,
].join("\n");

suite("catálogo sugerido", () => {
  const sql = enabled ? neon(databaseUrl!) : null;

  beforeAll(async () => {
    await sql!`insert into "user" (id, name, email, email_verified) values
      (${ids.ownerA}, 'Dueña A', ${`${ids.ownerA}@example.invalid`}, true),
      (${ids.sellerA}, 'Vendedor A', ${`${ids.sellerA}@example.invalid`}, true),
      (${ids.ownerB}, 'Dueño B', ${`${ids.ownerB}@example.invalid`}, true)`;
    await sql!`insert into business (id, name, category, city, province, timezone) values
      (${ids.businessA}, 'Kiosco A', 'KIOSK', 'Test', 'Test', 'America/Argentina/Buenos_Aires'),
      (${ids.businessB}, 'Almacén B', 'GROCERY', 'Test', 'Test', 'America/Argentina/Buenos_Aires')`;
    await sql!`insert into business_member (id, business_id, user_id, role, is_current) values
      (${crypto.randomUUID()}, ${ids.businessA}, ${ids.ownerA}, 'OWNER', true),
      (${crypto.randomUUID()}, ${ids.businessA}, ${ids.sellerA}, 'SELLER', true),
      (${crypto.randomUUID()}, ${ids.businessB}, ${ids.ownerB}, 'OWNER', true)`;
    // El negocio A ya tiene el código 1; el B, el código 3.
    await sql!`insert into product (id, business_id, name, cost_price_cents, sale_price_cents, current_stock, minimum_stock, barcode, is_active) values
      (${ids.existingA}, ${ids.businessA}, 'Alfajor que ya tenía', 100, 200, 5, 0, ${code(1)}, true),
      (${ids.existingB}, ${ids.businessB}, 'Fideos de B', 100, 200, 5, 0, ${code(3)}, true)`;
  });

  afterAll(async () => {
    await sql!`delete from business where id in (${ids.businessA}, ${ids.businessB})`;
    await sql!`delete from "user" where id in (${ids.ownerA}, ${ids.sellerA}, ${ids.ownerB})`;
    await sql!`delete from catalog_product where barcode like ${`20${run}%`}`;
  });

  it("el seed no duplica: correrlo dos veces deja una fila por código", async () => {
    const { rows } = parseCatalogCsv(csv);
    await upsertCatalog(sql!, rows);
    await upsertCatalog(sql!, rows.map((row) => row.barcode === code(2) ? { ...row, name: `Gaseosa renombrada ${run}` } : row));
    const stored = await sql!`select barcode, name from catalog_product where barcode like ${`20${run}%`} order by barcode`;
    expect(stored).toHaveLength(3);
    expect(stored[1].name).toBe(`Gaseosa renombrada ${run}`);
  });

  it("busca por nombre, marca y código, y marca lo que el negocio ya tiene", async () => {
    const { searchCatalogForUser } = await import("@/data/catalog");
    const byName = await searchCatalogForUser(ids.ownerA, { query: `alfajor de prueba ${run}`, category: null, kioskOnly: false, page: 1 });
    expect(byName?.items.map((item) => [item.barcode, item.owned])).toEqual([[code(1), true]]);
    const byBrand = await searchCatalogForUser(ids.ownerA, { query: `otra marca ${run}`, category: null, kioskOnly: false, page: 1 });
    expect(byBrand?.items.map((item) => item.barcode)).toEqual([code(3)]);
    const byCode = await searchCatalogForUser(ids.ownerA, { query: code(3), category: null, kioskOnly: false, page: 1 });
    expect(byCode?.items.map((item) => [item.barcode, item.owned])).toEqual([[code(3), false]]);
    const kiosk = await searchCatalogForUser(ids.ownerA, { query: `prueba ${run}`, category: null, kioskOnly: true, page: 1 });
    expect(kiosk?.items.map((item) => item.barcode).sort()).toEqual([code(1), code(2)]);
    const category = await searchCatalogForUser(ids.ownerA, { query: `prueba ${run}`, category: "Bebidas", kioskOnly: false, page: 1 });
    expect(category?.items.map((item) => item.barcode)).toEqual([code(2)]);
    // Aislamiento: para el negocio B, el código 1 no figura como propio.
    const fromB = await searchCatalogForUser(ids.ownerB, { query: code(1), category: null, kioskOnly: false, page: 1 });
    expect(fromB?.items[0].owned).toBe(false);
    // Un vendedor no puede crear productos: no accede al catálogo.
    expect(await searchCatalogForUser(ids.sellerA, { query: "", category: null, kioskOnly: false, page: 1 })).toBeNull();
  });

  it("la creación en lote no duplica códigos que el negocio ya tiene", async () => {
    const { addCatalogProductsForUser } = await import("@/data/catalog");
    const items = [
      { barcode: code(1), salePriceCents: 500, costPriceCents: 0, initialStock: 3, minimumStock: 0 },
      { barcode: code(2), salePriceCents: 1500, costPriceCents: 900, initialStock: 0, minimumStock: 2 },
      { barcode: code(3), salePriceCents: 800, costPriceCents: 0, initialStock: 4, minimumStock: 1 },
    ];
    expect(await addCatalogProductsForUser(ids.sellerA, items)).toEqual({ ok: false, reason: "FORBIDDEN" });

    const first = await addCatalogProductsForUser(ids.ownerA, items);
    expect(first).toEqual({ ok: true, created: 2, skipped: [code(1)] });
    const again = await addCatalogProductsForUser(ids.ownerA, items);
    expect(again.ok && again.created).toBe(0);
    expect(again.ok && [...again.skipped].sort()).toEqual([code(1), code(2), code(3)]);

    const products = await sql!`
      select barcode, name, category, sale_price_cents::int as sale_price_cents, current_stock, minimum_stock
      from product where business_id = ${ids.businessA} order by barcode`;
    expect(products).toHaveLength(3);
    expect(products.find((row) => row.barcode === code(1))?.name).toBe("Alfajor que ya tenía");
    expect(products.find((row) => row.barcode === code(2))).toMatchObject({ name: `Gaseosa renombrada ${run} 2 L`, category: "Bebidas", sale_price_cents: 1500, current_stock: 0, minimum_stock: 2 });
    expect(products.find((row) => row.barcode === code(3))).toMatchObject({ name: `Fideos de prueba ${run} 500 g`, current_stock: 4 });
    const movements = await sql!`select quantity from stock_movement where business_id = ${ids.businessA} and type = 'INITIAL'`;
    expect(movements.map((row) => Number(row.quantity))).toEqual([4]);
    // El negocio B no recibió nada nuevo.
    const productsB = await sql!`select count(*)::int as total from product where business_id = ${ids.businessB}`;
    expect(productsB[0].total).toBe(1);
  });

  it("el escáner detecta productos del catálogo que el negocio no tiene", async () => {
    const { catalogSuggestionForUser } = await import("@/data/catalog");
    const suggestion = await catalogSuggestionForUser(ids.ownerB, code(2));
    expect(suggestion).toEqual({ barcode: code(2), name: `Gaseosa renombrada ${run} 2 L`, needsReview: true, canAdd: true });
    // Ya lo tiene: no se sugiere.
    expect(await catalogSuggestionForUser(ids.ownerB, code(3))).toBeNull();
    // No está en el catálogo.
    expect(await catalogSuggestionForUser(ids.ownerB, `20${run}999`)).toBeNull();
    // Un vendedor ve la sugerencia pero no puede agregarlo.
    const { catalogSuggestionForUser: forSeller } = await import("@/data/catalog");
    await sql!`delete from product where business_id = ${ids.businessA} and barcode = ${code(3)}`;
    expect(await forSeller(ids.sellerA, code(3))).toMatchObject({ canAdd: false });
  });
});
