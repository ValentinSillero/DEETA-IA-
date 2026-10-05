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
const ids = {
  userA: `test-scanner-user-a-${crypto.randomUUID()}`,
  userB: `test-scanner-user-b-${crypto.randomUUID()}`,
  businessA: `test-scanner-business-a-${crypto.randomUUID()}`,
  businessB: `test-scanner-business-b-${crypto.randomUUID()}`,
  memberA: `test-scanner-member-a-${crypto.randomUUID()}`,
  memberB: `test-scanner-member-b-${crypto.randomUUID()}`,
  productA: crypto.randomUUID(),
  productB: crypto.randomUUID(),
};
const barcode = `779${Date.now()}`;

suite("escáner y emparejamiento en PostgreSQL", () => {
  const sql = enabled ? neon(process.env.DATABASE_URL!) : null;

  beforeAll(async () => {
    await sql!`
      insert into "user" (id, name, email, email_verified)
      values
        (${ids.userA}, 'Scanner A', ${`${ids.userA}@example.invalid`}, true),
        (${ids.userB}, 'Scanner B', ${`${ids.userB}@example.invalid`}, true)
    `;
    await sql!`
      insert into business (id, name, category, city, province)
      values
        (${ids.businessA}, 'Scanner A', 'OTHER', 'Test', 'Test'),
        (${ids.businessB}, 'Scanner B', 'OTHER', 'Test', 'Test')
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
      ) values
        (${ids.productA}, ${ids.businessA}, 'Producto Scanner A', ${barcode}, 100, 250, 1, 0, true),
        (${ids.productB}, ${ids.businessB}, 'Producto Scanner B', ${barcode}, 100, 300, 5, 0, true)
    `;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`delete from scanner_scan_event where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from scanner_pairing_session where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from sale_item where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from income where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from stock_movement where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from sale where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from business where id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from "user" where id in (${ids.userA}, ${ids.userB})`;
  });

  it("aísla códigos, hace lecturas idempotentes y cierra el pairing con la venta", async () => {
    const {
      connectPairingForUser,
      createPairingForUser,
      findProductByBarcodeForUser,
      getPairingFeedForUser,
      sendRemoteScanForUser,
    } = await import("@/data/scanner");
    const { createStockMovementForUser } = await import("@/data/products");
    const { completeSaleForUser } = await import("@/data/sales");

    await expect(findProductByBarcodeForUser(ids.userA, barcode)).resolves.toMatchObject({ id: ids.productA });
    await expect(findProductByBarcodeForUser(ids.userB, barcode)).resolves.toMatchObject({ id: ids.productB });
    await expect(findProductByBarcodeForUser(ids.userA, `${barcode}9`)).resolves.toBeNull();
    await expect(sql!`
      insert into product (
        id, business_id, name, barcode, cost_price_cents, sale_price_cents,
        current_stock, minimum_stock, is_active
      ) values (${crypto.randomUUID()}, ${ids.businessA}, 'Duplicado', ${barcode}, 1, 1, 0, 0, true)
    `).rejects.toThrow();

    const created = await createPairingForUser(ids.userA, crypto.randomUUID());
    expect(created).not.toBeNull();
    if (!created) return;
    await expect(connectPairingForUser(ids.userB, created.token)).resolves.toBeNull();
    await expect(connectPairingForUser(ids.userA, created.token)).resolves.toMatchObject({ status: "CONNECTED" });

    const firstId = crypto.randomUUID();
    const first = await sendRemoteScanForUser(ids.userA, created.token, {
      pairingId: created.pairing.id, eventId: firstId, barcode, format: "EAN_13",
    });
    expect(first).toMatchObject({ ok: true, duplicate: false, event: { status: "FOUND", product: { id: ids.productA } } });
    const duplicate = await sendRemoteScanForUser(ids.userA, created.token, {
      pairingId: created.pairing.id, eventId: firstId, barcode, format: "EAN_13",
    });
    expect(duplicate).toMatchObject({ ok: true, duplicate: true, event: { id: firstId, status: "FOUND" } });
    const outOfStock = await sendRemoteScanForUser(ids.userA, created.token, {
      pairingId: created.pairing.id, eventId: crypto.randomUUID(), barcode, format: "EAN_13",
    });
    expect(outOfStock).toMatchObject({ ok: true, event: { status: "OUT_OF_STOCK", product: { id: ids.productA } } });

    await expect(getPairingFeedForUser(ids.userB, created.pairing.id, 0)).resolves.toBeNull();
    const feed = await getPairingFeedForUser(ids.userA, created.pairing.id, 0);
    expect(feed?.events.map((event) => event.status)).toEqual(["FOUND", "OUT_OF_STOCK"]);

    await expect(createStockMovementForUser(ids.userB, ids.productA, { type: "IN", amount: 2, reason: "Cámara" }))
      .resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
    await expect(createStockMovementForUser(ids.userA, ids.productA, { type: "IN", amount: 2, reason: "Cámara" }))
      .resolves.toMatchObject({ ok: true, previousStock: 1, resultingStock: 3, quantity: 2 });

    const completed = await completeSaleForUser(ids.userA, {
      items: [{ productId: ids.productA, quantity: 1 }],
      paymentMethod: "TRANSFER",
      receivedCashCents: null,
      pairingSessionId: created.pairing.id,
    });
    expect(completed).toMatchObject({ ok: true, totalCents: 250 });
    await expect(sendRemoteScanForUser(ids.userA, created.token, {
      pairingId: created.pairing.id, eventId: crypto.randomUUID(), barcode, format: "EAN_13",
    })).resolves.toEqual({ ok: false, reason: "INVALID_PAIRING" });

    const expired = await createPairingForUser(ids.userA, crypto.randomUUID());
    expect(expired).not.toBeNull();
    if (!expired) return;
    await sql!`update scanner_pairing_session set expires_at = now() - interval '1 second' where id = ${expired.pairing.id}`;
    await expect(connectPairingForUser(ids.userA, expired.token)).resolves.toBeNull();
    const [expiredState] = await sql!`select status from scanner_pairing_session where id = ${expired.pairing.id}`;
    expect(expiredState.status).toBe("EXPIRED");
  });
});
