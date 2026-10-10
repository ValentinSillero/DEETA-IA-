import { describe, expect, it } from "vitest";

import { getTrustedAuthOrigins } from "@/lib/auth-origins";

describe("orígenes confiables de autenticación", () => {
  it("incluye el dominio público y las URLs exactas generadas por Vercel", () => {
    expect(getTrustedAuthOrigins("https://deetaia.vercel.app", {
      VERCEL_URL: "deeta-deploy-equipo.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "deetaia.vercel.app",
      VERCEL_BRANCH_URL: "https://deeta-git-main-equipo.vercel.app/ruta",
    })).toEqual([
      "https://deetaia.vercel.app",
      "https://deeta-deploy-equipo.vercel.app",
      "https://deeta-git-main-equipo.vercel.app",
    ]);
  });

  it("descarta valores inválidos y no agrega comodines", () => {
    const origins = getTrustedAuthOrigins("http://localhost:3000", {
      VERCEL_URL: "valor inválido",
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_BRANCH_URL: "ftp://deeta.vercel.app",
    });

    expect(origins).toEqual(["http://localhost:3000"]);
    expect(origins).not.toContain("https://*.vercel.app");
  });
});
