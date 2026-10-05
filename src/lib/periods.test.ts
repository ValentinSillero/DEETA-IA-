import { describe, expect, it } from "vitest";

import { resolveAiPeriod, resolveAnalysisPeriod, resolveCustomPeriod } from "@/lib/periods";

describe("períodos de análisis", () => {
  it("compara el mes actual contra la misma cantidad de días", () => {
    expect(resolveAnalysisPeriod("2026-10-04", "CURRENT_MONTH")).toEqual({
      current: { start: "2026-10-01", end: "2026-10-04" },
      previous: { start: "2026-09-01", end: "2026-09-04" },
    });
  });

  it("recorta correctamente cuando el mes anterior es más corto", () => {
    expect(resolveAnalysisPeriod("2026-03-31", "CURRENT_MONTH").previous.end).toBe("2026-02-28");
  });

  it("resuelve ayer y los últimos 30 días sin depender de UTC local", () => {
    expect(resolveAiPeriod("2026-10-04", { kind: "YESTERDAY", month: null }).current).toEqual({ start: "2026-10-03", end: "2026-10-03" });
    expect(resolveAiPeriod("2026-10-04", { kind: "LAST_30_DAYS", month: null }).current).toEqual({ start: "2026-09-05", end: "2026-10-04" });
  });

  it("resuelve un mes calendario solicitado", () => {
    expect(resolveAiPeriod("2026-10-04", { kind: "SPECIFIC_MONTH", month: "2026-09" }).current).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("compara un período personalizado contra los días inmediatamente anteriores", () => {
    expect(resolveCustomPeriod("2026-10-04", "2026-09-10", "2026-09-19")).toEqual({
      current: { start: "2026-09-10", end: "2026-09-19" },
      previous: { start: "2026-08-31", end: "2026-09-09" },
    });
    expect(() => resolveCustomPeriod("2026-10-04", "2026-10-05", "2026-10-06")).toThrow("INVALID_PERIOD");
  });
});
