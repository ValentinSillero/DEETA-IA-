import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildWhatsappLink,
  getSupportWhatsappNumber,
  normalizeWhatsappNumber,
  supportMessage,
  supportSectionKey,
  supportSectionLabel,
} from "@/lib/support";

afterEach(() => vi.unstubAllEnvs());

describe("número de WhatsApp", () => {
  it("acepta formatos habituales y deja solo dígitos", () => {
    expect(normalizeWhatsappNumber("+54 9 11 1234-5678")).toBe("5491112345678");
    expect(normalizeWhatsappNumber("(598) 99 123 456")).toBe("59899123456");
  });

  it("rechaza valores faltantes o inválidos", () => {
    expect(normalizeWhatsappNumber(undefined)).toBeNull();
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber("1234")).toBeNull();
    expect(normalizeWhatsappNumber("54911abc5678")).toBeNull();
    expect(normalizeWhatsappNumber("5491112345678?text=hola")).toBeNull();
  });

  it("sin variable configurada no hay número", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "");
    expect(getSupportWhatsappNumber()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "+54 9 11 1234 5678");
    expect(getSupportWhatsappNumber()).toBe("5491112345678");
  });
});

describe("enlace wa.me", () => {
  it("codifica el mensaje completo", () => {
    const link = buildWhatsappLink("5491112345678", "Hola, ¿cómo va? & 100% #1");
    expect(link).toBe("https://wa.me/5491112345678?text=Hola%2C%20%C2%BFc%C3%B3mo%20va%3F%20%26%20100%25%20%231");
    expect(new URL(link).searchParams.get("text")).toBe("Hola, ¿cómo va? & 100% #1");
  });
});

describe("mensajes por tipo", () => {
  it("cada tipo tiene su mensaje inicial", () => {
    expect(supportMessage("question")).toBe("Hola, estoy usando DEETA y tengo una duda: ");
    expect(supportMessage("problem")).toBe("Hola, encontré un problema usando DEETA: ");
    expect(supportMessage("suggestion")).toBe("Hola, estoy probando DEETA y quería sugerir una mejora: ");
  });

  it("agrega solo el nombre de la sección", () => {
    expect(supportMessage("question", "Caja")).toBe("Hola, estoy usando DEETA en la sección Caja y tengo una duda: ");
    expect(supportMessage("problem", "Productos")).toBe("Hola, encontré un problema usando DEETA en la sección Productos: ");
    expect(supportMessage("suggestion", "Ventas")).toBe("Hola, estoy probando DEETA y quería sugerir una mejora para la sección Ventas: ");
  });

  it("toma la sección de la ruta sin IDs y descarta valores desconocidos", () => {
    expect(supportSectionKey("/productos/0b9c-uuid/editar")).toBe("productos");
    expect(supportSectionKey("/ayuda")).toBeNull();
    expect(supportSectionLabel("caja")).toBe("Caja");
    expect(supportSectionLabel("constructor")).toBeNull();
    expect(supportSectionLabel("<script>")).toBeNull();
  });
});
