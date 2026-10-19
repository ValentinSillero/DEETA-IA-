import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinalCta, PublicFooter } from "@/components/landing/sections";
import { LandingSupportLink } from "@/components/support/landing-support-link";
import { SupportOptions } from "@/components/support/support-options";

afterEach(() => vi.unstubAllEnvs());

function whatsappLinks(html: string) {
  return [...html.matchAll(/<a [^>]*href="(https:\/\/wa\.me\/[^"]+)"[^>]*>/g)].map((match) => ({
    tag: match[0],
    text: new URL(match[1].replaceAll("&amp;", "&")).searchParams.get("text"),
  }));
}

describe("contacto en la landing", () => {
  it("abre WhatsApp en otra pestaña con el mensaje de la landing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "+54 9 11 1234 5678");
    const html = renderToStaticMarkup(<FinalCta />);
    const [link] = whatsappLinks(html);
    expect(link.tag).toContain('href="https://wa.me/5491112345678?text=');
    expect(link.tag).toContain('target="_blank"');
    expect(link.tag).toContain('rel="noopener noreferrer"');
    expect(link.text).toBe("Hola, vi DEETA y quería hacer una consulta.");
    expect(html).toContain("Hablemos por WhatsApp");
    // El CTA principal sigue siendo empezar gratis.
    expect(html.indexOf("Empezar gratis")).toBeLessThan(html.indexOf("Hablemos por WhatsApp"));
  });

  it("sin número no muestra el contacto ni rompe la página", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "");
    expect(renderToStaticMarkup(<LandingSupportLink>WhatsApp</LandingSupportLink>)).toBe("");
    const html = renderToStaticMarkup(<><FinalCta /><PublicFooter /></>);
    expect(html).toContain("Empezar gratis");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("¿Tenés dudas antes de empezar?");
  });
});

describe("ayuda y sugerencias en la app", () => {
  it("ofrece duda, problema y sugerencia con su mensaje y la sección", () => {
    const html = renderToStaticMarkup(<SupportOptions number="5491112345678" section="Caja" />);
    const links = whatsappLinks(html);
    expect(links.map((link) => link.text)).toEqual([
      "Hola, estoy usando DEETA en la sección Caja y tengo una duda: ",
      "Hola, encontré un problema usando DEETA en la sección Caja: ",
      "Hola, estoy probando DEETA y quería sugerir una mejora para la sección Caja: ",
    ]);
    for (const link of links) expect(link.tag).toContain('rel="noopener noreferrer"');
    for (const label of ["Tengo una duda", "Encontré un problema", "Quiero sugerir una mejora"]) expect(html).toContain(label);
  });

  it("sin número muestra un aviso en lugar de enlaces", () => {
    const html = renderToStaticMarkup(<SupportOptions number={null} section={null} />);
    expect(html).not.toContain("wa.me");
    expect(html).toContain("todavía no está disponible");
  });
});
