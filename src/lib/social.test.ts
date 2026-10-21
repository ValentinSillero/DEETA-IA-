import { afterEach, describe, expect, it, vi } from "vitest";

import { getXProfile, normalizeXProfile } from "@/lib/social";

afterEach(() => vi.unstubAllEnvs());

describe("perfil de X", () => {
  it("acepta usuario o URL del perfil", () => {
    expect(normalizeXProfile("deeta_app")).toEqual({ handle: "deeta_app", url: "https://x.com/deeta_app" });
    expect(normalizeXProfile("@deeta_app")).toEqual({ handle: "deeta_app", url: "https://x.com/deeta_app" });
    expect(normalizeXProfile("https://twitter.com/deeta_app")).toEqual({ handle: "deeta_app", url: "https://x.com/deeta_app" });
    expect(normalizeXProfile("https://x.com/deeta_app?s=21")).toEqual({ handle: "deeta_app", url: "https://x.com/deeta_app" });
  });

  it("descarta valores vacíos o de otros sitios", () => {
    expect(normalizeXProfile("")).toBeNull();
    expect(normalizeXProfile("https://evil.com/deeta")).toBeNull();
    expect(normalizeXProfile("javascript:alert(1)")).toBeNull();
    expect(normalizeXProfile("http://x.com/deeta")).toBeNull();
    expect(normalizeXProfile("nombre con espacios")).toBeNull();
  });

  it("sin variable (o con un valor inválido) usa @valensilleroo", () => {
    const fallback = { handle: "valensilleroo", url: "https://x.com/valensilleroo" };
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_X", "");
    expect(getXProfile()).toEqual(fallback);
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_X", "https://evil.com/x");
    expect(getXProfile()).toEqual(fallback);
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_X", "@otra_cuenta");
    expect(getXProfile()?.handle).toBe("otra_cuenta");
  });
});
