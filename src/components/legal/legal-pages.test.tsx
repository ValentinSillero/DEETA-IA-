import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PrivacyPage from "@/app/privacidad/page";
import TermsPage from "@/app/terminos/page";

describe("páginas legales", () => {
  it("Términos: fecha fija, Beta y aviso de que no reemplaza asesoramiento", () => {
    const html = renderToStaticMarkup(<TermsPage />);
    expect(html).toContain("Última actualización: 21 de octubre de 2026");
    expect(html).toContain("etapa Beta");
    expect(html).toContain("no reemplazan el asesoramiento contable, fiscal o impositivo, financiero ni legal");
    expect(html).not.toContain("[COMPLETAR");
    expect(html).toContain('href="/privacidad"');
  });

  it("Privacidad: no vende datos, describe DEETA AI y la baja por contacto", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain("DEETA no vende los datos personales de sus usuarios.");
    expect(html).toContain("Qué se envía a Groq");
    expect(html).toContain("por ahora DEETA no tiene un botón para eliminar la cuenta");
    expect(html).toContain("Ley 25.326");
    expect(html).not.toContain("[COMPLETAR");
  });

  it("no quedan marcadores ni datos de ubicación; el contacto va por los canales del sitio", () => {
    for (const html of [renderToStaticMarkup(<TermsPage />), renderToStaticMarkup(<PrivacyPage />)]) {
      expect(html).not.toContain("[COMPLETAR");
      expect(html).not.toMatch(/domicilio|email de contacto/);
      expect(html).toContain("canales de contacto disponibles");
    }
  });

  it("el canal de contacto es X, sin WhatsApp", () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_X", "@deeta_app");
    for (const html of [renderToStaticMarkup(<TermsPage />), renderToStaticMarkup(<PrivacyPage />)]) {
      expect(html).toContain("el perfil de DEETA en X (Twitter)");
      expect(html).toContain('href="https://x.com/deeta_app"');
      expect(html).not.toMatch(/whatsapp|wa\.me/i);
    }
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_X", "");
    expect(renderToStaticMarkup(<PrivacyPage />)).not.toContain('id="canales-contacto"');
    vi.unstubAllEnvs();
  });

  it("la fecha no se calcula al vuelo", () => {
    for (const file of ["src/app/terminos/page.tsx", "src/app/privacidad/page.tsx"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/new Date\(/);
    }
  });
});
