import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
try {
  nextEnv.processEnv(
    [{ path: ".env.local", contents: readFileSync(".env.local", "utf8"), env: {} }],
    process.cwd(),
    undefined,
    true,
  );
} catch {
  // La prueba queda omitida cuando no existe configuración local.
}

const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;
const suffix = crypto.randomUUID();
const ids = {
  userA: `test-import-user-a-${suffix}`,
  userB: `test-import-user-b-${suffix}`,
  businessA: `test-import-business-a-${suffix}`,
  businessB: `test-import-business-b-${suffix}`,
  memberA: `test-import-member-a-${suffix}`,
  memberB: `test-import-member-b-${suffix}`,
  existingProduct: `test-import-product-${suffix}`,
};
const existingBarcode = `existing-${suffix}`;
const headers = ["Nombre", "Código", "Costo", "Venta", "Stock", "Mínimo"];
const mapping = { "0": "NAME", "1": "BARCODE", "2": "COST_PRICE", "3": "SALE_PRICE", "4": "INITIAL_STOCK", "5": "MINIMUM_STOCK" } as const;

suite("importación de productos en PostgreSQL", () => {
  const sql = enabled ? neon(process.env.DATABASE_URL!) : null;

  beforeAll(async () => {
    await sql!`
      insert into "user" (id, name, email, email_verified)
      values
        (${ids.userA}, 'Import A', ${`${ids.userA}@example.invalid`}, true),
        (${ids.userB}, 'Import B', ${`${ids.userB}@example.invalid`}, true)
    `;
    await sql!`
      insert into business (id, name, category, city, province)
      values
        (${ids.businessA}, 'Import A', 'OTHER', 'Test', 'Test'),
        (${ids.businessB}, 'Import B', 'OTHER', 'Test', 'Test')
    `;
    await sql!`
      insert into business_member (id, business_id, user_id, role)
      values
        (${ids.memberA}, ${ids.businessA}, ${ids.userA}, 'OWNER'),
        (${ids.memberB}, ${ids.businessB}, ${ids.userB}, 'OWNER')
    `;
    await sql!`
      insert into product (
        id, business_id, name, barcode, cost_price_cents, sale_price_cents,
        current_stock, minimum_stock, is_active
      ) values (${ids.existingProduct}, ${ids.businessA}, 'Producto existente', ${existingBarcode}, 10000, 15000, 10, 2, true)
    `;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`delete from business where id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from "user" where id in (${ids.userA}, ${ids.userB})`;
  });

  async function createAndValidate(row: string[], strategy: "SKIP" | "UPDATE_PRICES" | "UPDATE_PRICES_STOCK") {
    const { createProductImportForUser, validateProductImportForUser } = await import("@/data/product-imports");
    const created = await createProductImportForUser(ids.userA, {
      originalFilename: "productos.csv",
      fileType: "CSV",
      fileSize: 100,
      headers,
      rows: [row],
    });
    expect(created).not.toBeNull();
    const validated = await validateProductImportForUser(ids.userA, created!.id, mapping, strategy);
    expect(validated).toMatchObject({ ok: true, summary: { error: 0 } });
    return created!.id;
  }

  it("crea productos con movimiento inicial y confirma de forma idempotente", async () => {
    const { confirmProductImportForUser, getProductImportForUser } = await import("@/data/product-imports");
    const barcode = `new-${suffix}`;
    const importId = await createAndValidate(["Producto nuevo", barcode, "120,50", "200", "7", "1"], "SKIP");
    await expect(getProductImportForUser(ids.userB, importId)).resolves.toBeNull();
    await expect(confirmProductImportForUser(ids.userB, importId)).resolves.toBeNull();

    await expect(confirmProductImportForUser(ids.userA, importId)).resolves.toMatchObject({ completed: true });
    await expect(confirmProductImportForUser(ids.userA, importId)).resolves.toMatchObject({ alreadyCompleted: true });

    const [created] = await sql!`select id, current_stock, cost_price_cents from product where business_id = ${ids.businessA} and barcode = ${barcode}`;
    expect(created).toMatchObject({ current_stock: 7, cost_price_cents: "12050" });
    const movements = await sql!`select type, quantity, previous_stock, resulting_stock from stock_movement where product_id = ${created.id}`;
    expect(movements).toEqual([{ type: "INITIAL", quantity: 7, previous_stock: 0, resulting_stock: 7 }]);
  });

  it("omite duplicados existentes sin modificar el producto", async () => {
    const { confirmProductImportForUser } = await import("@/data/product-imports");
    const importId = await createAndValidate(["Otro nombre", existingBarcode, "999", "1500", "30", "8"], "SKIP");
    await expect(confirmProductImportForUser(ids.userA, importId)).resolves.toMatchObject({ completed: true, batch: { skippedRows: 1 } });
    const [product] = await sql!`select name, cost_price_cents, current_stock from product where id = ${ids.existingProduct}`;
    expect(product).toMatchObject({ name: "Producto existente", cost_price_cents: "10000", current_stock: 10 });
  });

  it("actualiza precios sin tocar stock", async () => {
    const { confirmProductImportForUser } = await import("@/data/product-imports");
    const importId = await createAndValidate(["Producto existente", existingBarcode, "200", "350", "30", "4"], "UPDATE_PRICES");
    await expect(confirmProductImportForUser(ids.userA, importId)).resolves.toMatchObject({ completed: true, batch: { updatedRows: 1 } });
    const [product] = await sql!`select cost_price_cents, sale_price_cents, current_stock, minimum_stock from product where id = ${ids.existingProduct}`;
    expect(product).toMatchObject({ cost_price_cents: "20000", sale_price_cents: "35000", current_stock: 10, minimum_stock: 4 });
  });

  it("ajusta stock existente y registra el movimiento", async () => {
    const { confirmProductImportForUser } = await import("@/data/product-imports");
    const importId = await createAndValidate(["Producto existente", existingBarcode, "220", "380", "5", "3"], "UPDATE_PRICES_STOCK");
    await expect(confirmProductImportForUser(ids.userA, importId)).resolves.toMatchObject({ completed: true, batch: { updatedRows: 1 } });
    const [product] = await sql!`select current_stock from product where id = ${ids.existingProduct}`;
    expect(product.current_stock).toBe(5);
    const movements = await sql!`
      select type, quantity, previous_stock, resulting_stock, reason
      from stock_movement
      where product_id = ${ids.existingProduct} and id = ${`import-adjust-${(await sql!`select id from product_import_row where import_id = ${importId}`)[0].id}`}
    `;
    expect(movements).toEqual([{
      type: "ADJUSTMENT",
      quantity: -5,
      previous_stock: 10,
      resulting_stock: 5,
      reason: "Ajuste de stock por importación",
    }]);
  });
});
