import { describe, expect, it } from "vitest";

import { visibleAiResponseText } from "@/lib/ai/presentation-display";
import type { AiPresentation } from "@/lib/ai/presentation";

const presentation: AiPresentation = {
  type: "product-list",
  variant: "stock",
  title: "Productos con stock bajo",
  summary: "Tenés 2 productos sin stock. Estos son los que conviene revisar primero.",
  items: [
    { productName: "Alfajor chocolate", currentStock: 0, status: "out_of_stock" },
    { productName: "Agua mineral", currentStock: 0, status: "out_of_stock" },
  ],
};

describe("texto visible de las respuestas de DEETA AI", () => {
  it("omite todo texto introductorio cuando hay cards", () => {
    const detailedText = "Los productos con menor stock son Alfajor chocolate y Agua mineral, ambos con 0 unidades.";
    expect(visibleAiResponseText(detailedText, presentation)).toBeNull();
  });

  it("mantiene el texto completo cuando no hay contenido estructurado", () => {
    const explanation = "Las ventas crecieron, pero también aumentaron los gastos.";
    expect(visibleAiResponseText(explanation)).toBe(explanation);
  });

  it("omite todo texto introductorio cuando existe un business overview", () => {
    const overview: AiPresentation = {
      type: "business-overview",
      title: "Resumen del negocio",
      summary: "Vendiste más, pero el resultado fue menor.",
      metrics: [{ type: "sales", title: "Ventas", value: "$ 100", explanation: "Vendiste más.", tone: "positive" }],
      recommendations: [],
      periodLabel: "1–7 oct 2026",
    };
    const markdown = "**Resumen ejecutivo**\n- **Ventas:** $ 100";
    expect(visibleAiResponseText(markdown, overview)).toBeNull();
  });

  it("omite la introducción de cards guardadas antes de agregar summary", () => {
    expect(visibleAiResponseText("detalle largo", { ...presentation, summary: undefined })).toBeNull();
  });
});
