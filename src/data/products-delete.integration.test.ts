import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
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

const uid = crypto.randomUUID();
const run = String(Date.now()).slice(-8);
const code = (index: number) => `21${run}${String(index).padStart(3, "0")}`;
const ids = {
  ownerA: `del-owner-a-${uid}`, adminA: `del-admin-a-${uid}`, managerA: `del-manager-a-${uid}`, sellerA: `del-seller-a-${uid}`,
  ownerB: `del-owner-b-${uid}`,
  businessA: `del-business-a-${uid}`, businessB: `del-business-b-${uid}`,
};

function newProduct(name: string, initialStock: number, barcode: string | null = null) {
  return { name, description: null, costPriceCents: 100, salePriceCents: 250, initialStock, minimumStock: 0, barcode } as never;
}

suite("eliminar productos sin romper el historial", { timeout: 30_000 }, () => {
  const sql = enabled ? neon(databaseUrl!) : null;
  const exists = async (productId: string) =>
    Number((await sql!`select count(*)::int as total from product where id = ${productId}`)[0].total) === 1;

  beforeAll(async () => {
    await sql!`insert into "user" (id, name, email, email_verified) values
      (${ids.ownerA}, 'Dueña A', ${`${ids.ownerA}@example.invalid`}, true),
      (${ids.adminA}, 'Admin A', ${`${ids.adminA}@example.invalid`}, true),
      (${ids.managerA}, 'Encargado A', ${`${ids.managerA}@example.invalid`}, true),
      (${ids.sellerA}, 'Vendedor A', ${`${ids.sellerA}@example.invalid`}, true),
      (${ids.ownerB}, 'Dueño B', ${`${ids.ownerB}@example.invalid`}, true)`;
    await sql!`insert into business (id, name, category, city, province) values
      (${ids.businessA}, 'Kiosco A', 'KIOSK', 'Test', 'Test'),
      (${ids.businessB}, 'Kiosco B', 'KIOSK', 'Test', 'Test')`;
    await sql!`insert into business_member (id, business_id, user_id, role, is_current) values
      (${crypto.randomUUID()}, ${ids.businessA}, ${ids.ownerA}, 'OWNER', true),
      (${crypto.randomUUID()}, ${ids.businessA}, ${ids.adminA}, 'ADMIN', true),
      (${crypto.randomUUID()}, ${ids.businessA}, ${ids.managerA}, 'MANAGER', true),
      (${crypto.randomUUID()}, ${ids.businessA}, ${ids.sellerA}, 'SELLER', true),
      (${crypto.randomUUID()}, ${ids.businessB}, ${ids.ownerB}, 'OWNER', true)`;
    await sql!`insert into catalog_product (barcode, name, size, category, brand, is_kiosk, needs_review, source) values
      (${code(1)}, ${`Alfajor de prueba ${run}`}, '60 g', 'Alfajores', 'Marca Prueba', true, false, 'test')`;
  });

  afterAll(async () => {
    if (!sql) return;
    const businesses = [ids.businessA, ids.businessB];
    await sql`delete from scanner_scan_event where business_id = any(${businesses})`;
    await sql`delete from scanner_pairing_session where business_id = any(${businesses})`;
    await sql`delete from sale_item where business_id = any(${businesses})`;
    await sql`delete from income where business_id = any(${businesses})`;
    await sql`delete from stock_movement where business_id = any(${businesses})`;
    await sql`delete from sale where business_id = any(${businesses})`;
    await sql`delete from business where id = any(${businesses})`;
    await sql`delete from "user" where id = any(${[ids.ownerA, ids.adminA, ids.managerA, ids.sellerA, ids.ownerB]})`;
    await sql`delete from catalog_product where barcode like ${`21${run}%`}`;
  });

  it("1. un producto recién creado, sin historial, se elimina junto con su stock inicial", async () => {
    const { createProductForUser, deleteProductForUser, getMovementsForUser, canDeleteFromMovements } = await import("@/data/products");
    const created = await createProductForUser(ids.ownerA, newProduct("Recién creado", 5));
    const movements = await getMovementsForUser(ids.ownerA, created.id);
    expect(movements.map(({ movement }) => movement.type)).toEqual(["INITIAL"]);
    expect(canDeleteFromMovements(movements.map(({ movement }) => movement))).toBe(true);

    await expect(deleteProductForUser(ids.ownerA, created.id)).resolves.toEqual({ ok: true, name: "Recién creado" });
    expect(await exists(created.id)).toBe(false);
    expect(Number((await sql!`select count(*)::int as total from stock_movement where product_id = ${created.id}`)[0].total)).toBe(0);
  });

  it("2. un producto desactivado sin historial también se puede eliminar", async () => {
    const { createProductForUser, setProductActiveForUser, deleteProductForUser } = await import("@/data/products");
    const created = await createProductForUser(ids.ownerA, newProduct("Desactivado", 0));
    await setProductActiveForUser(ids.ownerA, created.id, false);
    // El administrador también tiene el permiso.
    await expect(deleteProductForUser(ids.adminA, created.id)).resolves.toMatchObject({ ok: true });
    expect(await exists(created.id)).toBe(false);
  });

  it("3. un producto con una venta no se elimina y la venta queda intacta", async () => {
    const { createProductForUser, deleteProductForUser } = await import("@/data/products");
    const { completeSaleForUser } = await import("@/data/sales");
    const created = await createProductForUser(ids.ownerA, newProduct("Vendido", 3));
    const sale = await completeSaleForUser(ids.ownerA, { items: [{ productId: created.id, quantity: 1 }], paymentMethod: "TRANSFER", receivedCashCents: null } as never);
    expect(sale).toMatchObject({ ok: true });

    await expect(deleteProductForUser(ids.ownerA, created.id)).resolves.toEqual({ ok: false, reason: "HAS_HISTORY" });
    expect(await exists(created.id)).toBe(true);
    expect(Number((await sql!`select count(*)::int as total from sale_item where product_id = ${created.id}`)[0].total)).toBe(1);
  });

  it("4. un producto con movimientos posteriores al alta no se elimina", async () => {
    const { createProductForUser, createStockMovementForUser, deleteProductForUser, getMovementsForUser, canDeleteFromMovements } = await import("@/data/products");
    const created = await createProductForUser(ids.ownerA, newProduct("Con ajuste", 2));
    await expect(createStockMovementForUser(ids.ownerA, created.id, { type: "IN", amount: 4, reason: "Compra" } as never)).resolves.toMatchObject({ ok: true });
    const movements = await getMovementsForUser(ids.ownerA, created.id);
    expect(canDeleteFromMovements(movements.map(({ movement }) => movement))).toBe(false);

    await expect(deleteProductForUser(ids.ownerA, created.id)).resolves.toEqual({ ok: false, reason: "HAS_HISTORY" });
    expect(await exists(created.id)).toBe(true);
    expect(Number((await sql!`select count(*)::int as total from stock_movement where product_id = ${created.id}`)[0].total)).toBe(2);
  });

  it("5. un usuario del negocio B no puede eliminar un producto del negocio A", async () => {
    const { createProductForUser, deleteProductForUser } = await import("@/data/products");
    const created = await createProductForUser(ids.ownerA, newProduct("De A", 0));
    await expect(deleteProductForUser(ids.ownerB, created.id)).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await exists(created.id)).toBe(true);
  });

  it("6. eliminar un producto agregado desde el catálogo no toca el catálogo global", async () => {
    const { addCatalogProductsForUser } = await import("@/data/catalog");
    const { deleteProductForUser } = await import("@/data/products");
    const item = { barcode: code(1), salePriceCents: 500, costPriceCents: 0, initialStock: 2, minimumStock: 0 };
    // Los dos negocios lo agregan desde el catálogo.
    expect(await addCatalogProductsForUser(ids.ownerA, [item])).toMatchObject({ ok: true, created: 1 });
    expect(await addCatalogProductsForUser(ids.ownerB, [item])).toMatchObject({ ok: true, created: 1 });
    const fromA = (await sql!`select id from product where business_id = ${ids.businessA} and barcode = ${code(1)}`)[0];

    await expect(deleteProductForUser(ids.ownerA, String(fromA.id))).resolves.toMatchObject({ ok: true });
    expect(Number((await sql!`select count(*)::int as total from catalog_product where barcode = ${code(1)}`)[0].total)).toBe(1);
    // El producto de B sigue en pie.
    expect(Number((await sql!`select count(*)::int as total from product where business_id = ${ids.businessB} and barcode = ${code(1)}`)[0].total)).toBe(1);
    // A puede volver a agregarlo desde el catálogo.
    expect(await addCatalogProductsForUser(ids.ownerA, [item])).toMatchObject({ ok: true, created: 1 });
  });

  it("7. llamar directo al servidor con un producto con historial se rechaza, aunque no tenga movimientos", async () => {
    const { createProductForUser, deleteProductForUser, getMovementsForUser, canDeleteFromMovements } = await import("@/data/products");
    const { createPairingForUser, connectPairingForUser, sendRemoteScanForUser } = await import("@/data/scanner");
    // Sin stock inicial: no tiene movimientos, pero sí una lectura del escáner.
    const created = await createProductForUser(ids.ownerA, newProduct("Escaneado", 0, code(7)));
    const pairing = await createPairingForUser(ids.ownerA, crypto.randomUUID());
    expect(pairing).not.toBeNull();
    if (!pairing) return;
    await connectPairingForUser(ids.ownerA, pairing.token);
    await expect(sendRemoteScanForUser(ids.ownerA, pairing.token, {
      pairingId: pairing.pairing.id, eventId: crypto.randomUUID(), barcode: code(7), format: "EAN_13",
    })).resolves.toMatchObject({ ok: true });
    // La interfaz no lo sabría por los movimientos: el servidor igual lo frena.
    expect(canDeleteFromMovements((await getMovementsForUser(ids.ownerA, created.id)).map(({ movement }) => movement))).toBe(true);

    await expect(deleteProductForUser(ids.ownerA, created.id)).resolves.toEqual({ ok: false, reason: "HAS_HISTORY" });
    expect(await exists(created.id)).toBe(true);
  });

  it("8. un rol sin permiso no puede eliminar", async () => {
    const { createProductForUser, deleteProductForUser } = await import("@/data/products");
    const created = await createProductForUser(ids.ownerA, newProduct("Protegido", 0));
    await expect(deleteProductForUser(ids.managerA, created.id)).resolves.toEqual({ ok: false, reason: "FORBIDDEN" });
    await expect(deleteProductForUser(ids.sellerA, created.id)).resolves.toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(await exists(created.id)).toBe(true);
  });
});
