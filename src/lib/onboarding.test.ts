import { describe, expect, it } from "vitest";

import {
  buildOnboardingPlan,
  parseOnboardingCookie,
  serializeOnboardingCookie,
  type OnboardingSignals,
} from "@/lib/onboarding";

const now = new Date("2026-10-15T15:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const empty: OnboardingSignals = {
  hasProducts: false,
  hasStock: false,
  hasCashActivity: false,
  hasSales: false,
  hasExpenses: false,
  firstProductAt: null,
  firstCashAt: null,
  firstSaleAt: null,
};

function plan(signals: Partial<OnboardingSignals>, options: { role?: "OWNER" | "ADMIN" | "EMPLOYEE" | "MANAGER" | "SELLER"; preference?: "minimized" | "dismissed" | null } = {}) {
  return buildOnboardingPlan({ signals: { ...empty, ...signals }, role: options.role ?? "OWNER", preference: options.preference ?? null, now });
}

describe("onboarding derivado de datos reales", () => {
  it("negocio nuevo: muestra los pasos, recomienda productos y bloquea la venta", () => {
    const result = plan({});
    expect(result.mode).toBe("checklist");
    expect(result.completed).toBe(0);
    expect(result.total).toBe(3);
    expect(result.steps.map((step) => [step.id, step.status])).toEqual([["products", "next"], ["cash", "pending"], ["sale", "blocked"]]);
    expect(result.steps[0].actions.map((action) => action.href)).toEqual(["/productos/nuevo", "/productos/importar"]);
    expect(result.steps[2].actions).toEqual([]);
    expect(result.extras.map((extra) => extra.id)).toEqual(["expenses"]);
  });

  it("productos sin stock: pide cargar stock en lugar de un paso redundante", () => {
    const result = plan({ hasProducts: true, firstProductAt: daysAgo(1) });
    expect(result.steps[0]).toMatchObject({ status: "next", title: "Cargá el stock de tus productos" });
    expect(result.steps[0].actions).toEqual([{ label: "Cargar stock", href: "/productos?estado=out", variant: "primary" }]);
    expect(result.steps[2].status).toBe("blocked");
  });

  it("negocio parcial: productos con stock sí, ventas no", () => {
    const result = plan({ hasProducts: true, hasStock: true, firstProductAt: daysAgo(1) });
    expect(result.completed).toBe(1);
    expect(result.steps.map((step) => step.status)).toEqual(["done", "next", "pending"]);
    expect(result.steps[2].actions).toEqual([{ label: "Nueva venta", href: "/vender", variant: "primary" }]);
    expect(result.extras.some((extra) => extra.id === "ai")).toBe(false);
  });

  it("la venta completa su paso automáticamente y recién ahí sugiere DEETA AI", () => {
    const result = plan({ hasProducts: true, hasStock: true, hasSales: true, firstProductAt: daysAgo(1), firstSaleAt: daysAgo(0) });
    expect(result.steps.find((step) => step.id === "sale")?.status).toBe("done");
    expect(result.completed).toBe(2);
    expect(result.mode).toBe("checklist");
    expect(result.extras.map((extra) => extra.id)).toContain("ai");
    // El fiado aparece como función secundaria, nunca como paso obligatorio.
    expect(result.extras.map((extra) => extra.id)).toContain("customers");
    expect(result.steps.map((step) => step.id)).toEqual(["products", "cash", "sale"]);
  });

  it("al completar todo muestra 'Todo listo' unos días y después desaparece", () => {
    const done = { hasProducts: true, hasStock: true, hasCashActivity: true, hasSales: true, hasExpenses: true, firstProductAt: daysAgo(2), firstCashAt: daysAgo(1), firstSaleAt: daysAgo(1) };
    expect(plan(done).mode).toBe("completed");
    expect(plan(done, { preference: "dismissed" }).mode).toBe("hidden");
    expect(plan({ ...done, firstProductAt: daysAgo(10), firstCashAt: daysAgo(9), firstSaleAt: daysAgo(8) }).mode).toBe("hidden");
  });

  it("negocio activo con meses de datos: no vuelve a ver el onboarding", () => {
    const active = { hasProducts: true, hasStock: true, hasCashActivity: true, hasSales: true, hasExpenses: true, firstProductAt: daysAgo(200), firstCashAt: daysAgo(199), firstSaleAt: daysAgo(199) };
    expect(plan(active).mode).toBe("hidden");
  });

  it("negocio que vende hace semanas sin usar caja tampoco ve el onboarding", () => {
    const result = plan({ hasProducts: true, hasStock: true, hasSales: true, firstProductAt: daysAgo(90), firstSaleAt: daysAgo(90) });
    expect(result.completed).toBe(2);
    expect(result.mode).toBe("hidden");
  });

  it("minimizar o cerrar mientras está incompleto deja una forma discreta de volver", () => {
    expect(plan({}, { preference: "minimized" }).mode).toBe("minimized");
    expect(plan({}, { preference: "dismissed" }).mode).toBe("minimized");
  });

  it("permisos: un vendedor no ve acciones de catálogo que no puede realizar", () => {
    const result = plan({}, { role: "SELLER" });
    expect(result.steps[0]).toMatchObject({ status: "blocked", actions: [] });
    expect(result.steps[0].description).toMatch(/Pedile/);
    expect(result.steps[1]).toMatchObject({ status: "next" });
    expect(result.steps[1].actions[0].href).toBe("/caja");
    const withSales = plan({ hasProducts: true, hasStock: true, hasSales: true, firstSaleAt: daysAgo(0) }, { role: "SELLER" });
    expect(withSales.extras.map((extra) => extra.id)).not.toContain("ai");
  });

  it("los administradores tienen las mismas acciones que el dueño", () => {
    expect(plan({}, { role: "ADMIN" }).steps[0].actions).toHaveLength(2);
  });
});

describe("preferencia visual por negocio", () => {
  it("guarda y lee el estado de cada negocio por separado", () => {
    let cookie = serializeOnboardingCookie(undefined, "business-a", "dismissed");
    cookie = serializeOnboardingCookie(cookie, "business-b", "minimized");
    const parsed = parseOnboardingCookie(cookie);
    expect(parsed.get("business-a")).toBe("dismissed");
    expect(parsed.get("business-b")).toBe("minimized");
    expect(parsed.get("business-c")).toBeUndefined();
    const cleared = parseOnboardingCookie(serializeOnboardingCookie(cookie, "business-b", null));
    expect(cleared.has("business-b")).toBe(false);
    expect(cleared.get("business-a")).toBe("dismissed");
  });

  it("ignora valores manipulados", () => {
    const parsed = parseOnboardingCookie("ok:m|bad id:d|x:zz|<script>:m");
    expect([...parsed]).toEqual([["ok", "minimized"]]);
  });
});
