import { describe, expect, it } from "vitest";

import { decodeAiMessageContent, encodeAiMessageContent } from "@/lib/ai/message-content";
import type { AiPresentation } from "@/lib/ai/presentation";

const presentation: AiPresentation = {
  type: "product-list",
  variant: "stock",
  title: "Productos con stock bajo",
  items: [{ productName: "Producto", currentStock: 0, minimumStock: 4, status: "out_of_stock" }],
};

describe("contenido persistente de mensajes de DEETA AI", () => {
  it("conserva texto y presentación estructurada sin parsear la respuesta del modelo", () => {
    const stored = encodeAiMessageContent("Encontré un producto sin stock.", presentation);
    expect(decodeAiMessageContent(stored)).toEqual({ content: "Encontré un producto sin stock.", presentation });
  });

  it("mantiene compatibilidad con mensajes de texto existentes", () => {
    expect(decodeAiMessageContent("Respuesta anterior")).toEqual({ content: "Respuesta anterior" });
  });

  it("persiste un business overview sin convertirlo en Markdown", () => {
    const overview: AiPresentation = {
      type: "business-overview",
      title: "Resumen del negocio",
      summary: "Las ventas crecieron y el resultado mejoró.",
      metrics: [{ type: "sales", title: "Ventas", value: "$ 100", explanation: "Vendiste más.", tone: "positive" }],
      recommendations: ["Revisar los gastos."],
      periodLabel: "1–7 oct 2026",
    };
    expect(decodeAiMessageContent(encodeAiMessageContent("**Resumen ejecutivo**", overview))).toEqual({ content: "**Resumen ejecutivo**", presentation: overview });
  });

  it("no confía en estructuras almacenadas inválidas", () => {
    expect(decodeAiMessageContent('DEETA_AI_MESSAGE_V1:{"content":"texto","presentation":{"type":"html"}}')).toEqual({ content: "texto" });
  });
});
