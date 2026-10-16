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
const tag = crypto.randomUUID().slice(0, 8);
const ids = {
  owner: `test-team-owner-${tag}`, admin: `test-team-admin-${tag}`, lucas: `test-team-lucas-${tag}`, sofia: `test-team-sofia-${tag}`, ownerB: `test-team-ownerb-${tag}`,
  kiosco: `test-team-kiosco-${tag}`, despensa: `test-team-despensa-${tag}`,
  productA: crypto.randomUUID(), productB: crypto.randomUUID(),
};
const email = (id: string) => `${id}@example.invalid`;

suite("equipo, roles y permisos en PostgreSQL", { timeout: 180_000 }, () => {
  const sql = enabled ? neon(process.env.DATABASE_URL!) : null;
  beforeAll(async () => {
    await sql!`insert into "user" (id, name, email, email_verified) values
      (${ids.owner}, 'Valentín Sillero', ${email(ids.owner)}, true),
      (${ids.admin}, 'Ana Admin', ${email(ids.admin)}, true),
      (${ids.lucas}, 'Lucas Gómez', ${email(ids.lucas)}, true),
      (${ids.sofia}, 'Sofía Martínez', ${email(ids.sofia)}, true),
      (${ids.ownerB}, 'Dueña Despensa', ${email(ids.ownerB)}, true)`;
    await sql!`insert into business (id, name, category, city, province, timezone) values
      (${ids.kiosco}, 'Kiosco Central', 'KIOSK', 'Test', 'Test', 'America/Argentina/Buenos_Aires'),
      (${ids.despensa}, 'Despensa López', 'GROCERY', 'Test', 'Test', 'America/Argentina/Buenos_Aires')`;
    await sql!`insert into business_member (id, business_id, user_id, role) values
      (${crypto.randomUUID()}, ${ids.kiosco}, ${ids.owner}, 'OWNER'),
      (${crypto.randomUUID()}, ${ids.despensa}, ${ids.ownerB}, 'OWNER')`;
    await sql!`insert into product (id, business_id, name, cost_price_cents, sale_price_cents, current_stock, minimum_stock, is_active) values
      (${ids.productA}, ${ids.kiosco}, 'Coca Cola 2,25 L', 150000, 250000, 20, 5, true),
      (${ids.productB}, ${ids.despensa}, 'Producto de la despensa', 100, 200, 5, 0, true)`;
  });
  afterAll(async () => {
    if (!sql) return;
    for (const businessId of [ids.kiosco, ids.despensa]) {
      await sql`delete from audit_log where business_id = ${businessId}`;
      await sql`delete from business_invitation where business_id = ${businessId}`;
      await sql`delete from customer_account_movement where business_id = ${businessId}`;
      await sql`delete from sale_payment where business_id = ${businessId}`;
      await sql`delete from sale_item where business_id = ${businessId}`;
      await sql`delete from income where business_id = ${businessId}`;
      await sql`delete from stock_movement where business_id = ${businessId}`;
      await sql`delete from sale where business_id = ${businessId}`;
      await sql`delete from customer where business_id = ${businessId}`;
      await sql`delete from cash_session where business_id = ${businessId}`;
      await sql`delete from ai_usage where business_id = ${businessId}`;
      await sql`delete from ai_conversation where business_id = ${businessId}`;
      await sql`delete from business where id = ${businessId}`;
    }
    await sql`delete from "user" where id in (${ids.owner}, ${ids.admin}, ${ids.lucas}, ${ids.sofia}, ${ids.ownerB})`;
  });

  it("invita, acepta, separa negocios, bloquea escaladas y conserva quién hizo cada cosa", async () => {
    const team = await import("@/data/team");
    const { getActiveMembership, switchActiveBusinessForUser, getMembershipsForUser } = await import("@/data/membership");
    const { permissionDenied } = await import("@/lib/action-guard");
    const { completeSaleForUser, cancelSaleForUser, getSaleForUser } = await import("@/data/sales");
    const { openCashForUser, getCashSessionForUser } = await import("@/data/cash");
    const { createStockMovementForUser, getMovementsForUser, getSaleProductsForUser } = { ...(await import("@/data/products")), ...(await import("@/data/sales")) };
    const customers = await import("@/data/customers");
    const { createAiToolExecutor } = await import("@/data/ai-tools");

    // --- Invitaciones -------------------------------------------------
    const adminInvite = await team.createInvitationForUser(ids.owner, { email: email(ids.admin), role: "ADMIN" });
    expect(adminInvite.ok).toBe(true); if (!adminInvite.ok) return;
    expect(await team.acceptInvitationForUser(ids.admin, email(ids.admin), adminInvite.token)).toEqual({ ok: true, businessId: ids.kiosco });

    // Un administrador no puede invitar dueños.
    expect(await team.createInvitationForUser(ids.admin, { email: "otro@example.invalid", role: "OWNER" })).toEqual({ ok: false, reason: "OWNER_ONLY" });

    const sofiaInvite = await team.createInvitationForUser(ids.admin, { email: email(ids.sofia).toUpperCase(), role: "SELLER" });
    expect(sofiaInvite.ok).toBe(true); if (!sofiaInvite.ok) return;
    // El token no se guarda en texto plano.
    const stored = await sql!`select token_hash from business_invitation where id = ${sofiaInvite.invitationId}`;
    expect(stored[0].token_hash).not.toBe(sofiaInvite.token);
    expect(stored[0].token_hash).toBe(team.hashInvitationToken(sofiaInvite.token));
    // Invitación duplicada: la nueva invalida la anterior.
    const sofiaInvite2 = await team.createInvitationForUser(ids.owner, { email: email(ids.sofia), role: "SELLER" });
    expect(sofiaInvite2.ok).toBe(true); if (!sofiaInvite2.ok) return;
    expect(await team.acceptInvitationForUser(ids.sofia, email(ids.sofia), sofiaInvite.token)).toEqual({ ok: false, reason: "CANCELLED" });
    // Email incorrecto: tener el enlace no alcanza.
    expect(await team.acceptInvitationForUser(ids.lucas, email(ids.lucas), sofiaInvite2.token)).toEqual({ ok: false, reason: "WRONG_EMAIL" });
    expect(await team.acceptInvitationForUser(ids.sofia, email(ids.sofia), "token-que-no-existe-0000000000")).toEqual({ ok: false, reason: "INVALID" });
    // Aceptación válida: el rol sale de la invitación guardada.
    expect(await team.acceptInvitationForUser(ids.sofia, email(ids.sofia), sofiaInvite2.token)).toEqual({ ok: true, businessId: ids.kiosco });
    expect(await team.acceptInvitationForUser(ids.sofia, email(ids.sofia), sofiaInvite2.token)).toEqual({ ok: false, reason: "USED" });
    expect(await team.createInvitationForUser(ids.owner, { email: email(ids.sofia), role: "SELLER" })).toEqual({ ok: false, reason: "ALREADY_MEMBER" });
    expect((await getActiveMembership(ids.sofia))?.role).toBe("SELLER");

    // Invitación vencida.
    const lucasInvite = await team.createInvitationForUser(ids.owner, { email: email(ids.lucas), role: "MANAGER" });
    expect(lucasInvite.ok).toBe(true); if (!lucasInvite.ok) return;
    await sql!`update business_invitation set expires_at = now() - interval '1 minute' where id = ${lucasInvite.invitationId}`;
    expect(await team.acceptInvitationForUser(ids.lucas, email(ids.lucas), lucasInvite.token)).toEqual({ ok: false, reason: "EXPIRED" });
    const lucasInvite2 = await team.createInvitationForUser(ids.owner, { email: email(ids.lucas), role: "MANAGER" });
    expect(lucasInvite2.ok).toBe(true); if (!lucasInvite2.ok) return;
    expect((await team.acceptInvitationForUser(ids.lucas, email(ids.lucas), lucasInvite2.token)).ok).toBe(true);

    // --- Permisos en el servidor ---------------------------------------
    expect(await permissionDenied(ids.sofia, "PROFITABILITY_VIEW")).not.toBeNull();
    expect(await permissionDenied(ids.sofia, "SALE_CREATE")).toBeNull();
    expect(await permissionDenied(ids.lucas, "STOCK_ADJUST")).toBeNull();

    // Trazabilidad: Lucas abre caja y ajusta stock; Sofía vende y cobra fiado.
    const cash = await openCashForUser(ids.lucas, 0);
    expect(cash.ok).toBe(true); if (!cash.ok) return;
    expect(await createStockMovementForUser(ids.lucas, ids.productA, { type: "OUT", amount: 2, reason: "Rotura" })).toMatchObject({ ok: true });
    expect(await createStockMovementForUser(ids.sofia, ids.productA, { type: "OUT", amount: 1, reason: "Intento" })).not.toMatchObject({ ok: true });
    const juan = await customers.createCustomerForUser(ids.sofia, { name: "Juan Pérez", phone: null });
    expect(juan).not.toBeNull(); if (!juan) return;
    const sale = await completeSaleForUser(ids.sofia, { items: [{ productId: ids.productA, quantity: 2 }], payments: [{ method: "CASH", amountCents: 200000 }, { method: "CREDIT", amountCents: 300000 }], receivedCashCents: 200000, customerId: juan.id, clientRequestId: crypto.randomUUID() });
    expect(sale.ok).toBe(true); if (!sale.ok) return;
    expect(await customers.registerCustomerPaymentForUser(ids.sofia, { customerId: juan.id, amountCents: 100000, method: "TRANSFER", note: null, idempotencyKey: crypto.randomUUID() })).toMatchObject({ ok: true });

    // Vendedora sin permiso: cancelar venta y ajustar cuenta se rechazan en el servidor.
    expect(await cancelSaleForUser(ids.sofia, sale.saleId, "Intento")).not.toEqual({ ok: true });
    expect((await getSaleForUser(ids.owner, sale.saleId))?.status).toBe("COMPLETED");
    expect(await customers.adjustCustomerBalanceForUser(ids.sofia, { customerId: juan.id, direction: "DECREASE", amountCents: 100, reason: "Intento", idempotencyKey: crypto.randomUUID() })).toEqual({ ok: false, reason: "FORBIDDEN" });

    // El dueño ve quién hizo cada cosa.
    expect((await getSaleForUser(ids.owner, sale.saleId))?.createdByName).toBe("Sofía Martínez");
    expect((await getCashSessionForUser(ids.owner, cash.id))?.openedByName).toBe("Lucas Gómez");
    const movements = await getMovementsForUser(ids.owner, ids.productA);
    expect(movements.some((row) => row.movement.type === "OUT" && row.createdByName === "Lucas Gómez")).toBe(true);
    const juanDetail = await customers.getCustomerForUser(ids.owner, juan.id);
    expect(juanDetail?.movements.find((movement) => movement.type === "PAYMENT")?.createdByName).toBe("Sofía Martínez");

    // --- Escaladas de privilegios --------------------------------------
    expect(await team.changeMemberRoleForUser(ids.sofia, ids.sofia, "OWNER")).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(await team.changeMemberRoleForUser(ids.lucas, ids.sofia, "ADMIN")).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(await team.changeMemberRoleForUser(ids.admin, ids.sofia, "OWNER")).toEqual({ ok: false, reason: "OWNER_ONLY" });
    expect(await team.removeMemberForUser(ids.admin, ids.owner)).toEqual({ ok: false, reason: "OWNER_ONLY" });
    expect(await team.changeMemberRoleForUser(ids.owner, ids.owner, "ADMIN")).toEqual({ ok: false, reason: "SELF" });
    // Otro negocio no puede tocar a este equipo (IDOR).
    expect(await team.changeMemberRoleForUser(ids.ownerB, ids.sofia, "OWNER")).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await team.removeMemberForUser(ids.ownerB, ids.lucas)).toEqual({ ok: false, reason: "NOT_FOUND" });

    // Último dueño: con un segundo dueño se puede degradar, nunca dejar cero.
    expect(await team.changeMemberRoleForUser(ids.owner, ids.admin, "OWNER")).toEqual({ ok: true });
    expect(await team.changeMemberRoleForUser(ids.admin, ids.owner, "ADMIN")).toEqual({ ok: true });
    // Valentín ahora es administrador: ya no puede tocar al dueño.
    expect(await team.changeMemberRoleForUser(ids.owner, ids.admin, "SELLER")).toEqual({ ok: false, reason: "OWNER_ONLY" });
    // Se restablece: Valentín vuelve a ser dueño y Ana vuelve a administradora.
    expect(await team.changeMemberRoleForUser(ids.admin, ids.owner, "OWNER")).toEqual({ ok: true });
    expect(await team.changeMemberRoleForUser(ids.owner, ids.admin, "ADMIN")).toEqual({ ok: true });
    expect(await team.removeMemberForUser(ids.admin, ids.owner)).toEqual({ ok: false, reason: "OWNER_ONLY" });
    const owners = await sql!`select count(*)::int as count from business_member where business_id = ${ids.kiosco} and role = 'OWNER'`;
    expect(owners[0].count).toBe(1);

    // --- Multiempresa ----------------------------------------------------
    const despensaInvite = await team.createInvitationForUser(ids.ownerB, { email: email(ids.sofia), role: "MANAGER" });
    expect(despensaInvite.ok).toBe(true); if (!despensaInvite.ok) return;
    expect(await team.acceptInvitationForUser(ids.sofia, email(ids.sofia), despensaInvite.token)).toEqual({ ok: true, businessId: ids.despensa });
    // Al aceptar entra al negocio nuevo con su rol de ese negocio.
    expect(await getActiveMembership(ids.sofia)).toMatchObject({ businessId: ids.despensa, role: "MANAGER" });
    expect((await getSaleProductsForUser(ids.sofia)).map((product) => product.name)).toEqual(["Producto de la despensa"]);
    expect(await permissionDenied(ids.sofia, "STOCK_ADJUST")).toBeNull();
    expect((await getMembershipsForUser(ids.sofia)).map((membership) => [membership.businessId, membership.role])).toEqual(expect.arrayContaining([[ids.kiosco, "SELLER"], [ids.despensa, "MANAGER"]]));
    // Vuelve a Kiosco Central: permisos de vendedora y datos de ese negocio solamente.
    expect(await switchActiveBusinessForUser(ids.sofia, ids.kiosco)).toBe(true);
    expect(await getActiveMembership(ids.sofia)).toMatchObject({ businessId: ids.kiosco, role: "SELLER" });
    expect(await permissionDenied(ids.sofia, "STOCK_ADJUST")).not.toBeNull();
    expect((await getSaleProductsForUser(ids.sofia)).map((product) => product.name)).toEqual(["Coca Cola 2,25 L"]);
    // No puede "cambiarse" a un negocio al que no pertenece.
    expect(await switchActiveBusinessForUser(ids.lucas, ids.despensa)).toBe(false);
    expect((await getActiveMembership(ids.lucas))?.businessId).toBe(ids.kiosco);

    // --- DEETA AI respeta los mismos permisos ---------------------------
    await expect(createAiToolExecutor(ids.sofia)("get_period_summary", { kind: "CURRENT_MONTH", month: null })).rejects.toThrow("AI_TOOL_NOT_ALLOWED");
    await expect(createAiToolExecutor(ids.sofia)("getProductProfitability", { kind: "CURRENT_MONTH", month: null })).rejects.toThrow("AI_TOOL_NOT_ALLOWED");
    const stock = await createAiToolExecutor(ids.sofia)("get_product_performance", { productReference: "Coca Cola", kind: "CURRENT_MONTH", month: null }) as { matches: Array<Record<string, unknown>> };
    expect(stock.matches[0]).toMatchObject({ name: "Coca Cola 2,25 L", currentStock: 16 });
    expect(stock.matches[0]).not.toHaveProperty("grossMarginCents");
    const ownerView = await createAiToolExecutor(ids.owner)("get_product_performance", { productReference: "Coca Cola", kind: "CURRENT_MONTH", month: null }) as { matches: Array<Record<string, unknown>> };
    expect(ownerView.matches[0]).toHaveProperty("grossMarginCents");

    // La pregunta de rentabilidad de la vendedora no llega al modelo.
    const { askDeetaAi } = await import("@/lib/ai/service");
    const neverCalled = { name: "test", model: "test", respond: async () => { throw new Error("NO_DEBERIA_LLAMARSE"); } };
    const denied = await askDeetaAi(ids.sofia, { question: "¿Cuál fue nuestra ganancia este mes?", conversationId: null }, neverCalled);
    expect(denied).toMatchObject({ ok: true, answer: expect.stringContaining("Tu rol no tiene acceso") });

    // --- Quitar del negocio no borra cuenta ni historial -----------------
    expect(await team.removeMemberForUser(ids.owner, ids.sofia)).toEqual({ ok: true });
    expect(await getActiveMembership(ids.sofia)).toMatchObject({ businessId: ids.despensa, role: "MANAGER" });
    expect((await getSaleForUser(ids.owner, sale.saleId))?.createdByName).toBe("Sofía Martínez");
    expect(await getSaleForUser(ids.sofia, sale.saleId)).toBeNull();
    const userStill = await sql!`select 1 from "user" where id = ${ids.sofia}`;
    expect(userStill.length).toBe(1);

    // Auditoría de acciones sensibles, sin tokens.
    const audit = await sql!`select action, metadata::text as metadata from audit_log where business_id = ${ids.kiosco}`;
    expect(audit.map((row) => row.action)).toEqual(expect.arrayContaining(["TEAM_INVITE", "TEAM_JOIN", "TEAM_ROLE_CHANGE", "TEAM_REMOVE"]));
    expect(audit.some((row) => String(row.metadata).includes(sofiaInvite2.token))).toBe(false);
  });
});
