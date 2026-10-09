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

  it("distingue la semana calendario actual y la semana pasada de los últimos 7 días", () => {
    expect(resolveAiPeriod("2026-10-09", { kind: "CURRENT_WEEK", month: null })).toEqual({
      current: { start: "2026-10-05", end: "2026-10-09" },
      previous: { start: "2026-09-28", end: "2026-10-02" },
    });
    expect(resolveAiPeriod("2026-10-09", { kind: "PREVIOUS_WEEK", month: null })).toEqual({
      current: { start: "2026-09-28", end: "2026-10-04" },
      previous: { start: "2026-09-21", end: "2026-09-27" },
    });
    expect(resolveAiPeriod("2026-10-09", { kind: "LAST_7_DAYS", month: null }).current).toEqual({ start: "2026-10-03", end: "2026-10-09" });
  });

  it("resuelve un mes calendario solicitado", () => {
    expect(resolveAiPeriod("2026-10-04", { kind: "SPECIFIC_MONTH", month: "2026-09" }).current).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("compara el año actual contra las mismas fechas del año anterior", () => {
    expect(resolveAiPeriod("2026-10-09", { kind: "CURRENT_YEAR", month: null })).toEqual({
      current: { start: "2026-01-01", end: "2026-10-09" },
      previous: { start: "2025-01-01", end: "2025-10-09" },
    });
  });

  it("compara un período personalizado contra los días inmediatamente anteriores", () => {
    expect(resolveCustomPeriod("2026-10-04", "2026-09-10", "2026-09-19")).toEqual({
      current: { start: "2026-09-10", end: "2026-09-19" },
      previous: { start: "2026-08-31", end: "2026-09-09" },
    });
    expect(() => resolveCustomPeriod("2026-10-04", "2026-10-05", "2026-10-06")).toThrow("INVALID_PERIOD");
  });

  it("acepta un rango personalizado desde DEETA AI", () => {
    expect(resolveAiPeriod("2026-10-09", { kind: "CUSTOM_RANGE", month: null, start: "2026-09-10", end: "2026-09-19" })).toEqual({
      current: { start: "2026-09-10", end: "2026-09-19" },
      previous: { start: "2026-08-31", end: "2026-09-09" },
    });
  });
});
