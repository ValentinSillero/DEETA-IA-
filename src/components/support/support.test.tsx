import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinalCta, PublicFooter } from "@/components/landing/sections";
import { XProfileLink } from "@/components/support/x-profile-link";

afterEach(() => vi.unstubAllEnvs());

function xLinks(html: string) {
  return [...html.matchAll(/<a [^>]*href="(https:\/\/x\.com\/[^"]+)"[^>]*>/g)].map((match) => ({ tag: match[0], url: match[1] }));
}

describe("contacto por X", () => {
  it("Contacto en el footer de la landing lleva al perfil de X", () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_X", "@deeta_app");
    const html = renderToStaticMarkup(<PublicFooter />);
    const links = xLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("https://x.com/deeta_app");
    expect(links[0].tag).toContain('target="_blank"');
    expect(links[0].tag).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Contacto");
    expect(html).toContain('href="/terminos"');
    expect(html).toContain('href="/privacidad"');
  });

  it("no queda ningún acceso a WhatsApp", () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_X", "@deeta_app");
    const html = renderToStaticMarkup(<><FinalCta /><PublicFooter /></>);
    expect(html).not.toContain("wa.me");
    expect(html).not.toMatch(/whatsapp/i);
  });

  it("el CTA principal sigue siendo Empezar gratis, con el aviso de Beta", () => {
    const html = renderToStaticMarkup(<FinalCta />);
    expect(html).toContain("Empezar gratis");
    expect(html).toContain("Beta gratuita. Tu opinión nos ayuda a mejorar.");
    expect(html.indexOf("Empezar gratis")).toBeLessThan(html.indexOf("Beta gratuita"));
  });

  it("sin perfil configurado no muestra Contacto ni rompe la página", () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_X", "");
    expect(renderToStaticMarkup(<XProfileLink>Contacto</XProfileLink>)).toBe("");
    const html = renderToStaticMarkup(<><FinalCta /><PublicFooter /></>);
    expect(html).toContain("Empezar gratis");
    expect(html).not.toContain("x.com");
    expect(html).toContain('href="/terminos"');
  });
});
