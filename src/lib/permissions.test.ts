import { describe, expect, it } from "vitest";

import {
  ASSIGNABLE_ROLES,
  effectiveRole,
  hasPermission,
  invitationRoleIssue,
  PERMISSIONS,
  permissionsFor,
  rolesWith,
  teamRemovalIssue,
  teamRoleChangeIssue,
} from "@/lib/permissions";
import { maskEmail, safeNextPath } from "@/lib/safe-redirect";

describe("matriz central de permisos", () => {
  it("el dueño tiene acceso total", () => {
    expect(permissionsFor("OWNER")).toEqual([...PERMISSIONS]);
  });

  it("el administrador tiene todo salvo gestionar dueños", () => {
    expect(permissionsFor("ADMIN")).toEqual(PERMISSIONS.filter((permission) => permission !== "OWNER_MANAGE"));
    expect(hasPermission("ADMIN", "OWNER_MANAGE")).toBe(false);
    expect(hasPermission("ADMIN", "TEAM_MANAGE")).toBe(true);
    expect(hasPermission("ADMIN", "PROFITABILITY_VIEW")).toBe(true);
  });

  it("el encargado gestiona la operación diaria sin rentabilidad ni administración", () => {
    for (const permission of ["SALE_CREATE", "SALE_CANCEL", "PRODUCT_CREATE", "PRODUCT_PRICE_EDIT", "STOCK_ADJUST", "CASH_OPEN", "CASH_CLOSE", "EXPENSE_CREATE", "CUSTOMER_PAYMENT"] as const) {
      expect(hasPermission("MANAGER", permission)).toBe(true);
    }
    for (const permission of ["PROFITABILITY_VIEW", "TEAM_VIEW", "TEAM_MANAGE", "BUSINESS_SETTINGS", "CUSTOMER_ADJUSTMENT", "EXPENSE_CANCEL"] as const) {
      expect(hasPermission("MANAGER", permission)).toBe(false);
    }
  });

  it("el vendedor solo tiene lo necesario para vender", () => {
    expect(permissionsFor("SELLER")).toEqual(["SALE_CREATE", "SALE_VIEW", "CREDIT_SALE", "PRODUCT_VIEW", "STOCK_VIEW", "CASH_OPEN", "CUSTOMER_VIEW", "CUSTOMER_EDIT", "CUSTOMER_PAYMENT", "AI_USE"]);
    for (const permission of ["PROFITABILITY_VIEW", "ANALYTICS_VIEW", "EXPENSE_VIEW", "PRODUCT_PRICE_EDIT", "PRODUCT_EDIT", "STOCK_ADJUST", "SALE_CANCEL", "TEAM_VIEW", "BUSINESS_SETTINGS"] as const) {
      expect(hasPermission("SELLER", permission)).toBe(false);
    }
  });

  it("el rol anterior EMPLOYEE se trata como encargado, sin degradarlo a vendedor", () => {
    expect(effectiveRole("EMPLOYEE")).toBe("MANAGER");
    expect(permissionsFor("EMPLOYEE")).toEqual(permissionsFor("MANAGER"));
  });

  it("deriva las listas de roles para el SQL desde la matriz", () => {
    expect(rolesWith("SALE_CANCEL")).toEqual(["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"]);
    expect(rolesWith("PROFITABILITY_VIEW")).toEqual(["OWNER", "ADMIN"]);
    expect(rolesWith("OWNER_MANAGE")).toEqual(["OWNER"]);
    // Eliminar productos definitivamente: solo dueño y administrador.
    expect(rolesWith("PRODUCT_DELETE")).toEqual(["OWNER", "ADMIN"]);
    expect(rolesWith("SALE_CREATE")).toEqual(["OWNER", "ADMIN", "MANAGER", "SELLER", "EMPLOYEE"]);
  });

  it("no acepta roles inventados", () => {
    expect(hasPermission("SUPERUSER" as never, "SALE_CREATE")).toBe(false);
    expect(hasPermission(null, "SALE_CREATE")).toBe(false);
    expect(ASSIGNABLE_ROLES).not.toContain("EMPLOYEE");
  });
});

describe("reglas de equipo", () => {
  const base = { actorUserId: "a", targetUserId: "b", ownerCount: 1 } as const;

  it("protege al último dueño", () => {
    expect(teamRoleChangeIssue({ ...base, actorRole: "OWNER", targetRole: "OWNER", nextRole: "ADMIN" })).toBe("LAST_OWNER");
    expect(teamRemovalIssue({ ...base, actorRole: "OWNER", targetRole: "OWNER" })).toBe("LAST_OWNER");
    expect(teamRoleChangeIssue({ ...base, ownerCount: 2, actorRole: "OWNER", targetRole: "OWNER", nextRole: "ADMIN" })).toBeNull();
  });

  it("nadie se cambia el rol a sí mismo", () => {
    expect(teamRoleChangeIssue({ ...base, targetUserId: "a", actorRole: "OWNER", targetRole: "OWNER", nextRole: "SELLER" })).toBe("SELF");
    expect(teamRemovalIssue({ ...base, targetUserId: "a", actorRole: "ADMIN", targetRole: "ADMIN" })).toBe("SELF");
  });

  it("un administrador no puede crear ni tocar dueños", () => {
    expect(teamRoleChangeIssue({ ...base, actorRole: "ADMIN", targetRole: "SELLER", nextRole: "OWNER" })).toBe("OWNER_ONLY");
    expect(teamRoleChangeIssue({ ...base, ownerCount: 2, actorRole: "ADMIN", targetRole: "OWNER", nextRole: "SELLER" })).toBe("OWNER_ONLY");
    expect(teamRemovalIssue({ ...base, ownerCount: 2, actorRole: "ADMIN", targetRole: "OWNER" })).toBe("OWNER_ONLY");
    expect(invitationRoleIssue("ADMIN", "OWNER")).toBe("OWNER_ONLY");
    expect(invitationRoleIssue("ADMIN", "MANAGER")).toBeNull();
    expect(teamRoleChangeIssue({ ...base, actorRole: "ADMIN", targetRole: "SELLER", nextRole: "MANAGER" })).toBeNull();
  });

  it("encargados y vendedores no gestionan el equipo", () => {
    expect(teamRoleChangeIssue({ ...base, actorRole: "MANAGER", targetRole: "SELLER", nextRole: "MANAGER" })).toBe("FORBIDDEN");
    expect(teamRemovalIssue({ ...base, actorRole: "SELLER", targetRole: "SELLER" })).toBe("FORBIDDEN");
    expect(invitationRoleIssue("SELLER", "SELLER")).toBe("FORBIDDEN");
  });
});

describe("redirecciones seguras", () => {
  it("solo vuelve a enlaces de invitación internos", () => {
    expect(safeNextPath("/invitacion/abcdefghijklmnopqrstuvwxyz_-123")).toBe("/invitacion/abcdefghijklmnopqrstuvwxyz_-123");
    expect(safeNextPath("https://otro-sitio.com")).toBeNull();
    expect(safeNextPath("//otro-sitio.com/invitacion/x")).toBeNull();
    expect(safeNextPath("/dashboard")).toBeNull();
    expect(maskEmail("sofia.martinez@gmail.com")).toBe("so••••••@gmail.com");
  });
});
