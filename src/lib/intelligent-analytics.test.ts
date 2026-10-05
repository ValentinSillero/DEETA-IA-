import { describe, expect, it } from "vitest";

import {
  averageDailySales,
  classifyReorder,
  confidenceForHistory,
  estimatedStockDays,
  isImmobilized,
  isSlowMoving,
} from "@/lib/intelligent-analytics";

describe("análisis inteligente determinístico", () => {
  it("calcula velocidad y cobertura incluyendo días sin ventas", () => {
    const average = averageDailySales(40, 10);
    expect(average).toBe(4);
    expect(estimatedStockDays(20, average)).toBe(5);
  });

  it("no divide por cero ni inventa agotamiento", () => {
    expect(averageDailySales(0, 30)).toBe(0);
    expect(estimatedStockDays(20, 0)).toBeNull();
  });

  it("prioriza reposición por mínimo y cobertura", () => {
    expect(classifyReorder({ currentStock: 3, minimumStock: 5, estimatedDaysRemaining: 1.5 })).toBe("URGENT");
    expect(classifyReorder({ currentStock: 10, minimumStock: 5, estimatedDaysRemaining: 5 })).toBe("SOON");
    expect(classifyReorder({ currentStock: 30, minimumStock: 5, estimatedDaysRemaining: 20 })).toBe("OK");
  });

  it("detecta poco movimiento pero protege productos nuevos", () => {
    expect(isSlowMoving({ productAgeDays: 30, unitsSold: 1, currentStock: 50 })).toBe(true);
    expect(isSlowMoving({ productAgeDays: 2, unitsSold: 0, currentStock: 50 })).toBe(false);
  });

  it("detecta capital aproximado inmovilizado después de una ventana razonable", () => {
    expect(isImmobilized({ productAgeDays: 90, unitsSoldLast60Days: 0, currentStock: 30 })).toBe(true);
    expect(30 * 200_000).toBe(6_000_000);
  });

  it("expresa confianza según la cantidad de historial", () => {
    expect(confidenceForHistory(90)).toBe("HIGH");
    expect(confidenceForHistory(14)).toBe("MEDIUM");
    expect(confidenceForHistory(3)).toBe("LOW");
  });
});
