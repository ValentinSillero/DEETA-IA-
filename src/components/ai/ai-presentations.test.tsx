import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiProductPresentation } from "@/components/ai/ai-product-presentation";
import { AiMetricCard } from "@/components/ai/ai-metric-presentation";
import { aiEmptyAnswer } from "@/lib/ai/empty-answers";

describe("respuestas sin datos de DEETA AI", () => {
  it("convierte los textos fijos en un estado breve con próximo paso", () => {
    expect(aiEmptyAnswer("Todavía no hay ventas registradas en este período para identificar un producto más vendido.")).toMatchObject({ title: "Sin ventas todavía", action: "SELL" });
    expect(aiEmptyAnswer("Todavía no hay productos cargados para analizar el inventario.")).toMatchObject({ title: "Sin productos cargados", action: "ADD_PRODUCT" });
    expect(aiEmptyAnswer("No encontré productos que necesiten reposición con la información disponible.")).toMatchObject({ tone: "ok" });
  });

  it("deja intactas las respuestas comunes", () => {
    expect(aiEmptyAnswer("Este mes vendiste $ 30.000.")).toBeNull();
  });
});

describe("presentaciones compactas", () => {
  it("muestra el stock como dato principal y el estado con texto", () => {
    const html = renderToStaticMarkup(<AiProductPresentation presentation={{
      type: "product-list",
      variant: "stock",
      title: "Stock bajo",
      periodLabel: "Últimos 30 días",
      items: [{ productName: "Coca Cola 2,25 L", currentStock: 3, minimumStock: 8, unitsSold: 20, status: "low_stock" }],
    }} />);
    expect(html).toContain("Coca Cola 2,25 L");
    expect(html).toContain("3 unidades");
    expect(html).toContain("en stock");
    expect(html).toContain("Mínimo 8");
    expect(html).toContain("Stock bajo");
    expect(html).toContain("Últimos 30 días");
  });

  it("muestra los detalles de una métrica como filas concepto e importe", () => {
    const html = renderToStaticMarkup(<AiMetricCard presentation={{
      type: "metric",
      title: "Ventas del mes",
      value: "$ 30.000",
      explanation: "Lo que vendiste este mes.",
      details: [{ label: "Cantidad de ventas", value: "4" }, { label: "Promedio por venta", value: "$ 7.500" }],
    }} />);
    expect(html).toContain("ledger-row");
    expect(html).toContain("Cantidad de ventas");
    expect(html).toContain("$ 7.500");
  });
});
