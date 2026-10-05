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
  userA: `test-user-a-${crypto.randomUUID()}`,
  userB: `test-user-b-${crypto.randomUUID()}`,
  businessA: `test-business-a-${crypto.randomUUID()}`,
  businessB: `test-business-b-${crypto.randomUUID()}`,
  memberA: `test-member-a-${crypto.randomUUID()}`,
  memberB: `test-member-b-${crypto.randomUUID()}`,
  product: crypto.randomUUID(),
};

suite("venta atómica en PostgreSQL", () => {
  const sql = enabled ? neon(process.env.DATABASE_URL!) : null;

  beforeAll(async () => {
    await sql!`
      insert into "user" (id, name, email, email_verified)
      values
        (${ids.userA}, 'Test Venta A', ${`${ids.userA}@example.invalid`}, true),
        (${ids.userB}, 'Test Venta B', ${`${ids.userB}@example.invalid`}, true)
    `;
    await sql!`
      insert into business (id, name, category, city, province)
      values
        (${ids.businessA}, 'Test A', 'OTHER', 'Test', 'Test'),
        (${ids.businessB}, 'Test B', 'OTHER', 'Test', 'Test')
    `;
    await sql!`
      insert into business_member (id, business_id, user_id, role)
      values
        (${ids.memberA}, ${ids.businessA}, ${ids.userA}, 'OWNER'),
        (${ids.memberB}, ${ids.businessB}, ${ids.userB}, 'OWNER')
    `;
    await sql!`
      insert into product (
        id, business_id, name, cost_price_cents, sale_price_cents,
        current_stock, minimum_stock, is_active
      ) values (${ids.product}, ${ids.businessA}, 'Producto prueba', 100000, 250000, 10, 1, true)
    `;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`delete from sale_item where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from income where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from stock_movement where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from sale where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from cash_session where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from business where id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from "user" where id in (${ids.userA}, ${ids.userB})`;
  });

  it("guarda venta e ingreso, descuenta stock, aísla negocios y revierte al cancelar", async () => {
    const { openCashForUser, getCashSessionForUser } = await import("@/data/cash");
    const { cancelSaleForUser, completeSaleForUser, getSaleForUser } = await import("@/data/sales");
    const opened = await openCashForUser(ids.userA, 2_000_000);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const rejected = await completeSaleForUser(ids.userA, {
      items: [{ productId: ids.product, quantity: 20 }],
      paymentMethod: "CASH",
      receivedCashCents: 5_000_000,
    });
    expect(rejected).toEqual({ ok: false, reason: "INVALID_PRODUCTS_OR_STOCK" });
    const [untouched] = await sql!`
      select p.current_stock,
        (select count(*) from sale where business_id = ${ids.businessA})::int as sales,
        (select count(*) from income where business_id = ${ids.businessA})::int as incomes
      from product p where p.id = ${ids.product}
    `;
    expect(Number(untouched.current_stock)).toBe(10);
    expect(Number(untouched.sales)).toBe(0);
    expect(Number(untouched.incomes)).toBe(0);

    const completed = await completeSaleForUser(ids.userA, {
      items: [{ productId: ids.product, quantity: 2 }],
      paymentMethod: "CASH",
      receivedCashCents: 500_000,
    });
    expect(completed).toMatchObject({ ok: true, totalCents: 500_000 });
    if (!completed.ok) return;

    const [state] = await sql!`
      select p.current_stock,
        (select count(*) from sale where id = ${completed.saleId})::int as sales,
        (select count(*) from income where sale_id = ${completed.saleId} and status = 'ACTIVE')::int as incomes,
        (select expected_cash_cents from cash_session where id = ${opened.id}) as expected_cash
      from product p where p.id = ${ids.product}
    `;
    expect(Number(state.current_stock)).toBe(8);
    expect(Number(state.sales)).toBe(1);
    expect(Number(state.incomes)).toBe(1);
    expect(Number(state.expected_cash)).toBe(2_500_000);
    expect(await getSaleForUser(ids.userB, completed.saleId)).toBeNull();
    expect(await getCashSessionForUser(ids.userB, opened.id)).toBeNull();

    expect(await cancelSaleForUser(ids.userA, completed.saleId, "Prueba automática")).toEqual({ ok: true });
    const [reverted] = await sql!`
      select p.current_stock,
        (select status from income where sale_id = ${completed.saleId}) as income_status,
        (select expected_cash_cents from cash_session where id = ${opened.id}) as expected_cash,
        (select count(*) from stock_movement where product_id = ${ids.product} and type = 'RETURN')::int as returns
      from product p where p.id = ${ids.product}
    `;
    expect(Number(reverted.current_stock)).toBe(10);
    expect(reverted.income_status).toBe("REVERSED");
    expect(Number(reverted.expected_cash)).toBe(2_000_000);
    expect(Number(reverted.returns)).toBe(1);
  });
});
