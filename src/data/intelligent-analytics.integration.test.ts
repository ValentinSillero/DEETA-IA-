import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveAnalysisPeriod } from "@/lib/periods";

try { nextEnv.processEnv([{ path: ".env.local", contents: readFileSync(".env.local", "utf8"), env: {} }], process.cwd(), undefined, true); } catch { /* Opt-in. */ }
const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;
const suffix = crypto.randomUUID();
const ids = {
  users: [`smart-a-${suffix}`, `smart-b-${suffix}`], businesses: [`smart-ba-${suffix}`, `smart-bb-${suffix}`],
  products: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  sales: Array.from({ length: 13 }, () => crypto.randomUUID()),
};

suite("analytics inteligente multiempresa", () => {
  const sql = enabled ? neon(process.env.DATABASE_URL!) : null;
  beforeAll(async () => {
    await sql!`insert into "user" (id, name, email, email_verified) values
      (${ids.users[0]}, 'Smart A', ${`${ids.users[0]}@example.invalid`}, true),
      (${ids.users[1]}, 'Smart B', ${`${ids.users[1]}@example.invalid`}, true)`;
    await sql!`insert into business (id, name, category, city, province, timezone, created_at) values
      (${ids.businesses[0]}, 'Smart A', 'OTHER', 'Test', 'Test', 'America/Montevideo', now() - interval '120 days'),
      (${ids.businesses[1]}, 'Smart B', 'OTHER', 'Test', 'Test', 'America/Montevideo', now() - interval '120 days')`;
    await sql!`insert into business_member (id, business_id, user_id, role) values
      (${crypto.randomUUID()}, ${ids.businesses[0]}, ${ids.users[0]}, 'OWNER'),
      (${crypto.randomUUID()}, ${ids.businesses[1]}, ${ids.users[1]}, 'OWNER')`;
    await sql!`insert into product (id, business_id, name, cost_price_cents, sale_price_cents, current_stock, minimum_stock, is_active, created_at) values
      (${ids.products[0]}, ${ids.businesses[0]}, 'Producto A', 1000, 2000, 20, 5, true, now() - interval '90 days'),
      (${ids.products[1]}, ${ids.businesses[0]}, 'Producto B', 1000, 1800, 3, 5, true, now() - interval '90 days'),
      (${ids.products[2]}, ${ids.businesses[0]}, 'Stock quieto', 200000, 300000, 30, 0, true, now() - interval '90 days'),
      (${ids.products[3]}, ${ids.businesses[0]}, 'Producto nuevo', 1000, 2000, 50, 0, true, now() - interval '2 days'),
      (${ids.products[4]}, ${ids.businesses[1]}, 'Producto ajeno', 100, 200, 20, 0, true, now() - interval '90 days')`;
    for (let index = 0; index < 10; index += 1) {
      const createdAt = new Date(Date.now() - (index % 4) * 86_400_000);
      createdAt.setUTCHours(21, index, 0, 0);
      await sql!`insert into sale (id, business_id, total_cents, payment_method, status, created_by, created_at) values
        (${ids.sales[index]}, ${ids.businesses[0]}, 13000, 'CASH', 'COMPLETED', ${ids.users[0]}, ${createdAt})`;
      await sql!`insert into sale_item (id, business_id, sale_id, product_id, product_name_snapshot, quantity, unit_price_cents, unit_cost_cents, subtotal_cents) values
        (${crypto.randomUUID()}, ${ids.businesses[0]}, ${ids.sales[index]}, ${ids.products[0]}, 'Producto A', 2, 2000, 1000, 4000),
        (${crypto.randomUUID()}, ${ids.businesses[0]}, ${ids.sales[index]}, ${ids.products[1]}, 'Producto B', 5, 1800, 1000, 9000)`;
    }
    for (let index = 10; index < 12; index += 1) {
      const createdAt = new Date(Date.now() - index % 4 * 86_400_000); createdAt.setUTCHours(13, index, 0, 0);
      await sql!`insert into sale (id, business_id, total_cents, payment_method, status, created_by, created_at) values
        (${ids.sales[index]}, ${ids.businesses[0]}, 100, 'CASH', 'COMPLETED', ${ids.users[0]}, ${createdAt})`;
    }
    await sql!`insert into sale (id, business_id, total_cents, payment_method, status, created_by, created_at) values
      (${ids.sales[12]}, ${ids.businesses[1]}, 999999, 'CARD', 'COMPLETED', ${ids.users[1]}, now())`;
    await sql!`insert into sale_item (id, business_id, sale_id, product_id, product_name_snapshot, quantity, unit_price_cents, unit_cost_cents, subtotal_cents) values
      (${crypto.randomUUID()}, ${ids.businesses[1]}, ${ids.sales[12]}, ${ids.products[4]}, 'Producto ajeno', 1000, 1000, 1, 1000000)`;
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql`delete from sale_item where business_id = any(${ids.businesses})`;
    await sql`delete from sale where business_id = any(${ids.businesses})`;
    await sql`delete from product where business_id = any(${ids.businesses})`;
    await sql`delete from business where id = any(${ids.businesses})`;
    await sql`delete from "user" where id = any(${ids.users})`;
  });

  it("calcula rankings, rentabilidad, horarios, reposición y aislamiento", async () => {
    const todayRows = await sql!`select timezone('America/Montevideo', now())::date::text as today`;
    const ranges = resolveAnalysisPeriod(String(todayRows[0].today), "LAST_30_DAYS");
    const { getIntelligentAnalyticsForUser } = await import("@/data/intelligent-analytics");
    const result = await getIntelligentAnalyticsForUser(ids.users[0], ranges);
    expect(result).not.toBeNull(); if (!result) return;
    expect(result.rankings.byUnits[0]).toMatchObject({ name: "Producto B", units: 50 });
    expect(result.rankings.byProfitability[0]).toMatchObject({ name: "Producto B", grossMarginCents: 40_000 });
    expect(result.rankings.byProfitability.find((item) => item.name === "Producto A")?.grossMarginCents).toBe(20_000);
    expect(result.patterns.strongestHour).toMatchObject({ band: "18–20", operations: 10 });
    expect(result.inventory.reorderCandidates[0]).toMatchObject({ name: "Producto B", reorderPriority: "URGENT" });
    expect(result.inventory.immobilizedProducts).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Stock quieto", immobilizedValueCents: 6_000_000 })]));
    expect(result.rankings.slowMoving.map((item) => item.name)).not.toContain("Producto nuevo");
    expect(result.products.map((item) => item.name)).not.toContain("Producto ajeno");
  }, 30_000);
});
