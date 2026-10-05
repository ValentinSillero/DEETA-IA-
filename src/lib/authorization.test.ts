import { describe, expect, it } from "vitest";

import { manageableBusinessId } from "@/lib/authorization";

describe("aislamiento entre negocios", () => {
  it("permite al dueño administrar únicamente el negocio de su membresía", () => {
    expect(
      manageableBusinessId("user-a", {
        userId: "user-a",
        businessId: "business-a",
        role: "OWNER",
      }),
    ).toBe("business-a");
  });

  it("rechaza una membresía perteneciente a otro usuario", () => {
    expect(
      manageableBusinessId("user-a", {
        userId: "user-b",
        businessId: "business-b",
        role: "OWNER",
      }),
    ).toBeNull();
  });

  it("impide que un empleado cambie la información del negocio", () => {
    expect(
      manageableBusinessId("employee", {
        userId: "employee",
        businessId: "business-a",
        role: "EMPLOYEE",
      }),
    ).toBeNull();
  });
});
