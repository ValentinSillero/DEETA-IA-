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
  userA: `test-onboarding-a-${crypto.randomUUID()}`, userB: `test-onboarding-b-${crypto.randomUUID()}`, employeeB: `test-onboarding-e-${crypto.randomUUID()}`,
  businessA: `test-onboarding-business-a-${crypto.randomUUID()}`, businessB: `test-onboarding-business-b-${crypto.randomUUID()}`,
  categoryA: crypto.randomUUID(),
};

suite("onboarding por negocio en PostgreSQL", () => {
  const sql = enabled ? neon(process.env.DATABASE_URL!) : null;
  beforeAll(async () => {
    await sql!`insert into "user" (id, name, email, email_verified) values
      (${ids.userA}, 'Onboarding A', ${`${ids.userA}@example.invalid`}, true),
      (${ids.userB}, 'Onboarding B', ${`${ids.userB}@example.invalid`}, true),
      (${ids.employeeB}, 'Empleado B', ${`${ids.employeeB}@example.invalid`}, true)`;
    await sql!`insert into business (id, name, category, city, province, timezone) values
      (${ids.businessA}, 'Negocio completo', 'OTHER', 'Test', 'Test', 'America/Argentina/Buenos_Aires'),
      (${ids.businessB}, 'Almacén Prueba', 'OTHER', 'Test', 'Test', 'America/Argentina/Buenos_Aires')`;
    await sql!`insert into business_member (id, business_id, user_id, role) values
      (${crypto.randomUUID()}, ${ids.businessA}, ${ids.userA}, 'OWNER'),
      (${crypto.randomUUID()}, ${ids.businessB}, ${ids.userB}, 'OWNER'),
      (${crypto.randomUUID()}, ${ids.businessB}, ${ids.employeeB}, 'SELLER')`;
    await sql!`insert into expense_category (id, business_id, name) values (${ids.categoryA}, ${ids.businessA}, 'Pruebas')`;
  });
  afterAll(async () => {
    if (!sql) return;
    for (const businessId of [ids.businessA, ids.businessB]) {
      await sql`delete from expense where business_id = ${businessId}`;
      await sql`delete from expense_category where business_id = ${businessId}`;
      await sql`delete from sale_item where business_id = ${businessId}`;
      await sql`delete from income where business_id = ${businessId}`;
      await sql`delete from stock_movement where business_id = ${businessId}`;
      await sql`delete from sale where business_id = ${businessId}`;
      await sql`delete from cash_session where business_id = ${businessId}`;
      await sql`delete from business where id = ${businessId}`;
    }
    await sql`delete from "user" where id in (${ids.userA}, ${ids.userB}, ${ids.employeeB})`;
  });

  it("deriva el progreso de datos reales y no mezcla negocios", async () => {
    const { getBusinessOnboardingStateForUser } = await import("@/data/onboarding");
    const { createProductForUser } = await import("@/data/products");
    const { openCashForUser } = await import("@/data/cash");
    const { completeSaleForUser } = await import("@/data/sales");
    const { createExpenseForUser, getExpenseContextForUser } = await import("@/data/expenses");
    const { buildOnboardingPlan } = await import("@/lib/onboarding");

    // Negocio B nuevo: 0 productos, 0 ventas, 0 caja, 0 gastos.
    const fresh = await getBusinessOnboardingStateForUser(ids.userB);
    expect(fresh).toMatchObject({ businessId: ids.businessB, role: "OWNER", signals: { hasProducts: false, hasStock: false, hasCashActivity: false, hasSales: false, hasExpenses: false } });

    // Negocio A completo con los flujos reales.
    const created = await createProductForUser(ids.userA, { name: "Yerba", description: null, costPriceCents: 1000, salePriceCents: 2000, initialStock: 5, minimumStock: 0, barcode: null });
    const partial = await getBusinessOnboardingStateForUser(ids.userA);
    expect(partial?.signals).toMatchObject({ hasProducts: true, hasStock: true, hasCashActivity: false, hasSales: false });
    expect((await openCashForUser(ids.userA, 1000)).ok).toBe(true);
    expect(await completeSaleForUser(ids.userA, { items: [{ productId: created.id, quantity: 1 }], paymentMethod: "CASH", receivedCashCents: 2000 })).toMatchObject({ ok: true });
    const context = await getExpenseContextForUser(ids.userA);
    await createExpenseForUser(ids.userA, { description: "Luz", amountCents: 500, categoryId: ids.categoryA, paymentMethod: "TRANSFER", expenseDate: context!.today });

    const complete = await getBusinessOnboardingStateForUser(ids.userA);
    expect(complete).toMatchObject({ businessId: ids.businessA, signals: { hasProducts: true, hasStock: true, hasCashActivity: true, hasSales: true, hasExpenses: true } });
    expect(buildOnboardingPlan({ signals: complete!.signals, role: complete!.role, preference: null, now: new Date() })).toMatchObject({ mode: "completed", completed: 3 });

    // B sigue en cero: la actividad de A no se filtra.
    const stillFresh = await getBusinessOnboardingStateForUser(ids.userB);
    expect(stillFresh?.signals).toMatchObject({ hasProducts: false, hasSales: false, hasCashActivity: false, hasExpenses: false });
    expect(buildOnboardingPlan({ signals: stillFresh!.signals, role: "OWNER", preference: null, now: new Date() }).mode).toBe("checklist");

    // El empleado de B ve el mismo negocio, sin acciones de catálogo.
    const employee = await getBusinessOnboardingStateForUser(ids.employeeB);
    expect(employee).toMatchObject({ businessId: ids.businessB, role: "SELLER" });
    expect(buildOnboardingPlan({ signals: employee!.signals, role: employee!.role, preference: null, now: new Date() }).steps[0].actions).toEqual([]);

    // Un usuario sin negocio no obtiene estado.
    await expect(getBusinessOnboardingStateForUser(`unknown-${crypto.randomUUID()}`)).resolves.toBeNull();
  });
});
