import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacidad/page";
import TermsPage from "@/app/terminos/page";

describe("páginas legales", () => {
  it("Términos: fecha fija, Beta y aviso de que no reemplaza asesoramiento", () => {
    const html = renderToStaticMarkup(<TermsPage />);
    expect(html).toContain("Última actualización: 20 de octubre de 2026");
    expect(html).toContain("etapa Beta");
    expect(html).toContain("no reemplazan el asesoramiento contable, fiscal o impositivo, financiero ni legal");
    expect(html).toContain("[COMPLETAR: ");
    expect(html).toContain('href="/privacidad"');
  });

  it("Privacidad: no vende datos, describe DEETA AI y la baja por contacto", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain("DEETA no vende los datos personales de sus usuarios.");
    expect(html).toContain("Qué se envía a Groq");
    expect(html).toContain("por ahora DEETA no tiene un botón para eliminar la cuenta");
    expect(html).toContain("Ley 25.326");
    expect(html).toContain("[COMPLETAR: ");
  });

  it("la fecha no se calcula al vuelo", () => {
    for (const file of ["src/app/terminos/page.tsx", "src/app/privacidad/page.tsx"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/new Date\(/);
    }
  });
});
