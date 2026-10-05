import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
try {
  nextEnv.processEnv([{ path: ".env.local", contents: readFileSync(".env.local", "utf8"), env: {} }], process.cwd(), undefined, true);
} catch { /* Prueba opt-in sin configuración local. */ }

const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;
const ids = {
  userA: `test-expense-a-${crypto.randomUUID()}`, userB: `test-expense-b-${crypto.randomUUID()}`,
  businessA: `test-expense-business-a-${crypto.randomUUID()}`, businessB: `test-expense-business-b-${crypto.randomUUID()}`,
  memberA: crypto.randomUUID(), memberB: crypto.randomUUID(), product: crypto.randomUUID(),
  categoryA: crypto.randomUUID(), categoryB: crypto.randomUUID(),
};

suite("gastos y rentabilidad en PostgreSQL", () => {
  const sql = enabled ? neon(process.env.DATABASE_URL!) : null;
  beforeAll(async () => {
    await sql!`insert into "user" (id, name, email, email_verified) values
      (${ids.userA}, 'Gastos A', ${`${ids.userA}@example.invalid`}, true),
      (${ids.userB}, 'Gastos B', ${`${ids.userB}@example.invalid`}, true)`;
    await sql!`insert into business (id, name, category, city, province, timezone) values
      (${ids.businessA}, 'Gastos A', 'OTHER', 'Test', 'Test', 'America/Argentina/Buenos_Aires'),
      (${ids.businessB}, 'Gastos B', 'OTHER', 'Test', 'Test', 'America/Argentina/Buenos_Aires')`;
    await sql!`insert into business_member (id, business_id, user_id, role) values
      (${ids.memberA}, ${ids.businessA}, ${ids.userA}, 'OWNER'), (${ids.memberB}, ${ids.businessB}, ${ids.userB}, 'OWNER')`;
    await sql!`insert into expense_category (id, business_id, name) values
      (${ids.categoryA}, ${ids.businessA}, 'Pruebas'), (${ids.categoryB}, ${ids.businessB}, 'Pruebas')`;
    await sql!`insert into product (id, business_id, name, cost_price_cents, sale_price_cents, current_stock, minimum_stock, is_active)
      values (${ids.product}, ${ids.businessA}, 'Producto rentable', 6000, 10000, 10, 0, true)`;
  });
  afterAll(async () => {
    if (!sql) return;
    await sql`delete from expense where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from expense_category where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from sale_item where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from income where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from stock_movement where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from sale where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from cash_session where business_id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from business where id in (${ids.businessA}, ${ids.businessB})`;
    await sql`delete from "user" where id in (${ids.userA}, ${ids.userB})`;
  });

  it("usa costo histórico, afecta caja, excluye cancelados y aísla empresas", async () => {
    const { getFinancialAnalyticsForUser } = await import("@/data/analytics");
    const { openCashForUser, getCashSessionForUser } = await import("@/data/cash");
    const { cancelExpenseForUser, createExpenseForUser, getExpenseContextForUser, getExpenseForUser } = await import("@/data/expenses");
    const { cancelSaleForUser, completeSaleForUser } = await import("@/data/sales");
    const opened = await openCashForUser(ids.userA, 20_000);
    expect(opened.ok).toBe(true); if (!opened.ok) return;
    const sale = await completeSaleForUser(ids.userA, { items: [{ productId: ids.product, quantity: 1 }], paymentMethod: "CASH", receivedCashCents: 10_000 });
    expect(sale).toMatchObject({ ok: true, totalCents: 10_000 }); if (!sale.ok) return;
    const context = await getExpenseContextForUser(ids.userA); expect(context).not.toBeNull(); if (!context) return;

    const cashExpense = await createExpenseForUser(ids.userA, { description: "Limpieza", amountCents: 3_000, categoryId: ids.categoryA, paymentMethod: "CASH", expenseDate: context.today });
    expect(cashExpense).toMatchObject({ ok: true, linkedToCash: true }); if (!cashExpense.ok) return;
    const transferExpense = await createExpenseForUser(ids.userA, { description: "Internet", amountCents: 5_000, categoryId: ids.categoryA, paymentMethod: "TRANSFER", expenseDate: context.today });
    expect(transferExpense).toMatchObject({ ok: true, linkedToCash: false }); if (!transferExpense.ok) return;
    expect((await getCashSessionForUser(ids.userA, opened.id))?.expectedCashCents).toBe(27_000);

    await sql!`update product set cost_price_cents = 20000 where id = ${ids.product}`;
    const analytics = await getFinancialAnalyticsForUser(ids.userA, "TODAY");
    expect(analytics?.current).toMatchObject({ salesCents: 10_000, cogsCents: 6_000, grossMarginCents: 4_000, expensesCents: 8_000, estimatedResultCents: -4_000 });
    expect(analytics?.products[0]).toMatchObject({ cogsCents: 6_000, grossMarginCents: 4_000 });
    await expect(getExpenseForUser(ids.userB, cashExpense.id)).resolves.toBeNull();
    await expect(createExpenseForUser(ids.userB, { description: "Ajeno", amountCents: 1_000, categoryId: ids.categoryA, paymentMethod: "CASH", expenseDate: context.today })).resolves.toEqual({ ok: false, reason: "INVALID_CATEGORY" });
    const unlinked = await createExpenseForUser(ids.userB, { description: "Efectivo sin caja", amountCents: 900, categoryId: ids.categoryB, paymentMethod: "CASH", expenseDate: context.today });
    expect(unlinked).toMatchObject({ ok: true, linkedToCash: false });
    if (unlinked.ok) expect((await getExpenseForUser(ids.userB, unlinked.id))?.cashSessionId).toBeNull();

    await expect(cancelExpenseForUser(ids.userA, transferExpense.id, "Duplicado")).resolves.toEqual({ ok: true, cashRestored: false });
    expect((await getFinancialAnalyticsForUser(ids.userA, "TODAY"))?.current.expensesCents).toBe(3_000);
    await expect(cancelExpenseForUser(ids.userA, cashExpense.id, "Duplicado")).resolves.toEqual({ ok: true, cashRestored: true });
    expect((await getCashSessionForUser(ids.userA, opened.id))?.expectedCashCents).toBe(30_000);
    expect((await getFinancialAnalyticsForUser(ids.userA, "TODAY"))?.current.expensesCents).toBe(0);

    await expect(cancelSaleForUser(ids.userA, sale.saleId, "Prueba de rentabilidad")).resolves.toEqual({ ok: true });
    expect((await getFinancialAnalyticsForUser(ids.userA, "TODAY"))?.current).toMatchObject({ salesCents: 0, cogsCents: 0, grossMarginCents: 0 });
  }, 20_000);
});
