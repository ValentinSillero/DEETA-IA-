import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
try {
  nextEnv.processEnv([{ path: ".env.local", contents: readFileSync(".env.local", "utf8"), env: {} }], process.cwd(), undefined, true);
} catch { /* Prueba opt-in sin configuración local. */ }

const enabled = process.env.RUN_DB_TESTS === "1"
  && Boolean(process.env.DATABASE_URL)
  && Boolean(process.env.NEON_BRANCH)
  && !["main", "production", "prod"].includes(String(process.env.NEON_BRANCH).toLowerCase());
const suite = enabled ? describe : describe.skip;
const ids = {
  userA: `test-fiado-a-${crypto.randomUUID()}`, userB: `test-fiado-b-${crypto.randomUUID()}`,
  businessA: `test-fiado-business-a-${crypto.randomUUID()}`, businessB: `test-fiado-business-b-${crypto.randomUUID()}`,
  productA: crypto.randomUUID(), productB: crypto.randomUUID(),
};

suite("clientes, fiado y cuenta corriente en PostgreSQL", { timeout: 120_000 }, () => {
  const sql = enabled ? neon(process.env.DATABASE_URL!) : null;
  beforeAll(async () => {
    await sql!`insert into "user" (id, name, email, email_verified) values
      (${ids.userA}, 'Fiado A', ${`${ids.userA}@example.invalid`}, true),
      (${ids.userB}, 'Fiado B', ${`${ids.userB}@example.invalid`}, true)`;
    await sql!`insert into business (id, name, category, city, province, timezone) values
      (${ids.businessA}, 'Almacén Fiado', 'GROCERY', 'Test', 'Test', 'America/Argentina/Buenos_Aires'),
      (${ids.businessB}, 'Otro negocio', 'OTHER', 'Test', 'Test', 'America/Argentina/Buenos_Aires')`;
    await sql!`insert into business_member (id, business_id, user_id, role) values
      (${crypto.randomUUID()}, ${ids.businessA}, ${ids.userA}, 'OWNER'),
      (${crypto.randomUUID()}, ${ids.businessB}, ${ids.userB}, 'OWNER')`;
    // Producto de $10.000 con costo $6.000: tres unidades suman $30.000.
    await sql!`insert into product (id, business_id, name, cost_price_cents, sale_price_cents, current_stock, minimum_stock, is_active) values
      (${ids.productA}, ${ids.businessA}, 'Bolsa de alimento', 600000, 1000000, 20, 0, true),
      (${ids.productB}, ${ids.businessB}, 'Producto B', 100, 200, 5, 0, true)`;
  });
  afterAll(async () => {
    if (!sql) return;
    for (const businessId of [ids.businessA, ids.businessB]) {
      await sql`delete from customer_account_movement where business_id = ${businessId}`;
      await sql`delete from sale_payment where business_id = ${businessId}`;
      await sql`delete from sale_item where business_id = ${businessId}`;
      await sql`delete from income where business_id = ${businessId}`;
      await sql`delete from stock_movement where business_id = ${businessId}`;
      await sql`delete from sale where business_id = ${businessId}`;
      await sql`delete from customer where business_id = ${businessId}`;
      await sql`delete from cash_session where business_id = ${businessId}`;
      await sql`delete from business where id = ${businessId}`;
    }
    await sql`delete from "user" where id in (${ids.userA}, ${ids.userB})`;
  });

  it("separa lo vendido de lo cobrado y lleva la cuenta corriente con movimientos", async () => {
    const customers = await import("@/data/customers");
    const { openCashForUser, getCashSessionForUser } = await import("@/data/cash");
    const { completeSaleForUser, cancelSaleForUser, getSaleForUser } = await import("@/data/sales");
    const { getFinancialAnalyticsForUser } = await import("@/data/analytics");
    const { completeSaleSchema } = await import("@/lib/sale-validations");
    const item = (quantity: number) => [{ productId: ids.productA, quantity }];
    const balanceFromHistory = async (customerId: string) => {
      const rows = await sql!`select coalesce(sum(amount_cents), 0)::bigint as total from customer_account_movement where customer_id = ${customerId}`;
      return Number(rows[0].total);
    };

    // A. Cliente sin deuda, creado solo con el nombre.
    const juan = await customers.createCustomerForUser(ids.userA, { name: "Juan Pérez", phone: null });
    expect(juan).toMatchObject({ name: "Juan Pérez", balanceCents: 0, isActive: true });
    if (!juan) return;

    // H. Fiado sin cliente: lo rechaza la validación y también el servidor.
    expect(completeSaleSchema.safeParse({ items: item(1), payments: [{ method: "CREDIT", amountCents: 1000000 }], receivedCashCents: null }).success).toBe(false);
    expect(await completeSaleForUser(ids.userA, { items: item(1), payments: [{ method: "CREDIT", amountCents: 1000000 }], receivedCashCents: null, customerId: null }))
      .toEqual({ ok: false, reason: "CUSTOMER_REQUIRED" });

    // B. Venta 100 % fiada sin caja abierta: no entra dinero, la deuda sube.
    const fullCredit = await completeSaleForUser(ids.userA, { items: item(1), payments: [{ method: "CREDIT", amountCents: 1000000 }], receivedCashCents: null, customerId: juan.id, clientRequestId: crypto.randomUUID() });
    expect(fullCredit).toMatchObject({ ok: true, totalCents: 1000000 });
    if (!fullCredit.ok) return;
    expect((await customers.getCustomerForUser(ids.userA, juan.id))?.balanceCents).toBe(1000000);

    // G. Cancelar la venta fiada revierte la deuda con un movimiento nuevo.
    expect(await cancelSaleForUser(ids.userA, fullCredit.saleId, "Prueba")).toEqual({ ok: true });
    const afterCancel = await customers.getCustomerForUser(ids.userA, juan.id);
    expect(afterCancel?.balanceCents).toBe(0);
    expect(afterCancel?.movements.map((movement) => [movement.type, movement.amountCents])).toEqual([["SALE_CANCELLATION", -1000000], ["CREDIT_SALE", 1000000]]);

    // C. Venta parcialmente fiada: $30.000 = $10.000 efectivo + $20.000 fiado.
    const opened = await openCashForUser(ids.userA, 0);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const requestId = crypto.randomUUID();
    const partialInput = { items: item(3), payments: [{ method: "CASH" as const, amountCents: 1000000 }, { method: "CREDIT" as const, amountCents: 2000000 }], receivedCashCents: 1000000, customerId: juan.id, clientRequestId: requestId };
    const partial = await completeSaleForUser(ids.userA, partialInput);
    expect(partial).toMatchObject({ ok: true, totalCents: 3000000 });
    if (!partial.ok) return;
    // Doble confirmación con la misma clave: devuelve la misma venta y no duplica nada.
    expect(await completeSaleForUser(ids.userA, partialInput)).toEqual(partial);
    const sale = await getSaleForUser(ids.userA, partial.saleId);
    expect(sale).toMatchObject({ paymentMethod: "MIXED", cashCents: 1000000, creditCents: 2000000, customer: { id: juan.id } });
    expect((await getCashSessionForUser(ids.userA, opened.id))?.expectedCashCents).toBe(1000000);
    expect((await customers.getCustomerForUser(ids.userA, juan.id))?.balanceCents).toBe(2000000);
    const stock = await sql!`select current_stock from product where id = ${ids.productA}`;
    expect(Number(stock[0].current_stock)).toBe(17);
    const analytics = await getFinancialAnalyticsForUser(ids.userA, "TODAY");
    expect(analytics?.current.salesCents).toBe(3000000);
    expect(analytics?.current.cogsCents).toBe(1800000);
    expect(analytics?.payments).toMatchObject({ cashCents: 1000000, creditCents: 2000000 });

    // F. Pago mayor a la deuda: rechazado.
    expect(await customers.registerCustomerPaymentForUser(ids.userA, { customerId: juan.id, amountCents: 2500000, method: "CASH", note: null, idempotencyKey: crypto.randomUUID() }))
      .toEqual({ ok: false, reason: "EXCEEDS_BALANCE" });

    // Cancelar una venta con fiado ya pagado en parte queda bloqueado.
    const paymentKey = crypto.randomUUID();
    // D + J. Pago parcial en efectivo: impacta en caja.
    const cashPayment = await customers.registerCustomerPaymentForUser(ids.userA, { customerId: juan.id, amountCents: 800000, method: "CASH", note: null, idempotencyKey: paymentKey });
    expect(cashPayment).toMatchObject({ ok: true, balanceCents: 1200000, duplicated: false });
    // L. Doble pago con la misma clave: no se duplica.
    expect(await customers.registerCustomerPaymentForUser(ids.userA, { customerId: juan.id, amountCents: 800000, method: "CASH", note: null, idempotencyKey: paymentKey }))
      .toMatchObject({ ok: true, balanceCents: 1200000, duplicated: true });
    const cashAfterPayment = await getCashSessionForUser(ids.userA, opened.id);
    expect(cashAfterPayment?.expectedCashCents).toBe(1800000);
    expect(cashAfterPayment?.cashCustomerPaymentsCents).toBe(800000);
    expect(await cancelSaleForUser(ids.userA, partial.saleId, "Prueba")).toEqual({ ok: false, reason: "CREDIT_ALREADY_PAID" });

    // K. Pago por transferencia: no aumenta el efectivo esperado.
    expect(await customers.registerCustomerPaymentForUser(ids.userA, { customerId: juan.id, amountCents: 700000, method: "TRANSFER", note: null, idempotencyKey: crypto.randomUUID() }))
      .toMatchObject({ ok: true, balanceCents: 500000 });
    expect((await getCashSessionForUser(ids.userA, opened.id))?.expectedCashCents).toBe(1800000);

    // No se puede desactivar con deuda.
    expect(await customers.setCustomerActiveForUser(ids.userA, juan.id, false)).toEqual({ ok: false, reason: "HAS_DEBT" });

    // E. Pago total: saldo cero y al día, con historial completo.
    expect(await customers.registerCustomerPaymentForUser(ids.userA, { customerId: juan.id, amountCents: 500000, method: "CASH", note: null, idempotencyKey: crypto.randomUUID() }))
      .toMatchObject({ ok: true, balanceCents: 0 });
    const settled = await customers.getCustomerForUser(ids.userA, juan.id);
    expect(settled?.balanceCents).toBe(0);
    expect(settled?.movements).toHaveLength(6);
    expect(await balanceFromHistory(juan.id)).toBe(0);
    expect(await customers.registerCustomerPaymentForUser(ids.userA, { customerId: juan.id, amountCents: 100, method: "CASH", note: null, idempotencyKey: crypto.randomUUID() }))
      .toEqual({ ok: false, reason: "NO_DEBT" });

    // Ajuste: solo baja hasta cero y queda trazado.
    expect(await customers.adjustCustomerBalanceForUser(ids.userA, { customerId: juan.id, direction: "DECREASE", amountCents: 100, reason: "Error de carga", idempotencyKey: crypto.randomUUID() }))
      .toEqual({ ok: false, reason: "NEGATIVE_BALANCE" });
    expect(await customers.adjustCustomerBalanceForUser(ids.userA, { customerId: juan.id, direction: "INCREASE", amountCents: 150000, reason: "Deuda anterior a DEETA", idempotencyKey: crypto.randomUUID() }))
      .toEqual({ ok: true, balanceCents: 150000 });
    expect(await balanceFromHistory(juan.id)).toBe(150000);

    // I. Multiempresa: el cliente de A no existe para B, ni para ver, ni para cobrar, ni para fiar.
    expect(await customers.getCustomerForUser(ids.userB, juan.id)).toBeNull();
    expect((await customers.getCustomersPageForUser(ids.userB))?.customers).toEqual([]);
    expect(await customers.searchCustomersForUser(ids.userB, "Juan")).toEqual([]);
    expect(await customers.registerCustomerPaymentForUser(ids.userB, { customerId: juan.id, amountCents: 100, method: "TRANSFER", note: null, idempotencyKey: crypto.randomUUID() }))
      .toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await completeSaleForUser(ids.userB, { items: [{ productId: ids.productB, quantity: 1 }], payments: [{ method: "CREDIT", amountCents: 200 }], receivedCashCents: null, customerId: juan.id }))
      .toEqual({ ok: false, reason: "CUSTOMER_REQUIRED" });
    expect((await customers.getCustomerForUser(ids.userA, juan.id))?.balanceCents).toBe(150000);

    // Resumen agregado del negocio A.
    const page = await customers.getCustomersPageForUser(ids.userA, { filter: "debt" });
    expect(page?.summary).toMatchObject({ pendingCents: 150000, debtors: 1, paymentsThisMonthCents: 2000000 });
    expect(page?.customers.map((customer) => customer.name)).toEqual(["Juan Pérez"]);

    // DEETA AI: solo lectura y solo del propio negocio.
    const { createAiToolExecutor } = await import("@/data/ai-tools");
    const balances = await createAiToolExecutor(ids.userA)("get_customer_balances", { focus: "DEBTORS" }) as { totalPendingCents: number; customers: Array<{ name: string }> };
    expect(balances.totalPendingCents).toBe(150000);
    expect(balances.customers.map((customer) => customer.name)).toEqual(["Juan Pérez"]);
    const account = await createAiToolExecutor(ids.userA)("get_customer_account", { customerReference: "Juan" }) as { customer: { balanceCents: number } | null };
    expect(account.customer?.balanceCents).toBe(150000);
    const payments = await createAiToolExecutor(ids.userA)("get_customer_payments", { kind: "TODAY", month: null }) as { totalCents: number };
    expect(payments.totalCents).toBe(2000000);
    const otherBusiness = await createAiToolExecutor(ids.userB)("get_customer_balances", { focus: "DEBTORS" }) as { debtors: number };
    expect(otherBusiness.debtors).toBe(0);
    expect(await createAiToolExecutor(ids.userB)("get_customer_account", { customerReference: "Juan" })).toMatchObject({ found: false });
  });
});
