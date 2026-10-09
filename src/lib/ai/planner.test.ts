import { describe, expect, it } from "vitest";

import { clarificationForAiQuestion, planDeetaAiRequest } from "@/lib/ai/planner";
import type { AiConversationMessage } from "@/lib/ai/types";

describe("planificador eficiente de DEETA AI", () => {
  it.each([
    ["¿Qué producto vendo más este mes?", "get_top_product_analysis"],
    ["¿Qué producto vendo menos este mes?", "get_product_sales_ranking"],
    ["¿Qué productos no vendí este mes?", "get_product_sales_ranking"],
    ["¿Qué producto facturó más?", "get_product_sales_ranking"],
    ["¿Qué debería reponer?", "get_inventory_analysis"],
    ["¿Qué productos casi no se venden?", "get_inventory_analysis"],
    ["¿Qué producto tengo menos stock?", "get_inventory_analysis"],
    ["¿Qué productos tienen mucho stock?", "get_inventory_analysis"],
    ["¿Qué producto me deja más margen?", "getProductProfitability"],
    ["¿Cómo vienen mis gastos?", "get_expense_breakdown"],
    ["¿Por qué vendí más pero gané menos?", "get_period_summary"],
    ["¿En qué horario vendo más?", "get_sales_patterns"],
  ])("elige una tool de alto nivel para %s", (question, expected) => {
    expect(planDeetaAiRequest(question, [{ role: "USER", content: question }])).toMatchObject({ name: expected });
  });

  it.each([
    ["¿Qué producto tengo menos stock?", "LOWEST_STOCK"],
    ["¿Qué productos están sin stock?", "OUT_OF_STOCK"],
    ["¿Qué productos están debajo del mínimo?", "BELOW_MINIMUM"],
    ["¿Qué debería reponer?", "REORDER"],
    ["¿Qué productos casi no se venden?", "SLOW"],
    ["¿Qué productos tienen mucho stock?", "EXCESS"],
  ])("selecciona el análisis de inventario correcto para %s", (question, focus) => {
    expect(planDeetaAiRequest(question, [{ role: "USER", content: question }])).toMatchObject({
      name: "get_inventory_analysis",
      arguments: { focus, days: 30 },
    });
  });

  it.each([
    ["Analizá mi negocio.", "CURRENT_MONTH"],
    ["Haceme un análisis completo de mi negocio.", "CURRENT_MONTH"],
    ["¿Cómo viene mi negocio este mes?", "CURRENT_MONTH"],
    ["¿Qué debería mejorar?", "CURRENT_MONTH"],
    ["¿Qué pasó con mi negocio esta semana?", "CURRENT_WEEK"],
    ["¿Qué pasó con mi negocio la semana pasada?", "PREVIOUS_WEEK"],
  ])("usa el análisis agregado para %s", (question, kind) => {
    expect(planDeetaAiRequest(question, [{ role: "USER", content: question }])).toMatchObject({
      name: "get_business_period_analysis",
      arguments: { kind, month: null },
    });
  });

  it("mantiene la referencia al producto líder en un follow-up", () => {
    const messages: AiConversationMessage[] = [
      { role: "USER", content: "¿Qué producto vendo más este mes?" },
      { role: "ASSISTANT", content: "Gaseosa cola 500 ml." },
      { role: "USER", content: "¿Y cuánto margen me deja?" },
    ];
    expect(planDeetaAiRequest(messages[2].content, messages)).toMatchObject({ name: "get_top_product_analysis" });
  });

  it.each([
    ["¿Qué producto vendí menos?", "LEAST_UNITS", 1],
    ["¿Qué productos vendí menos?", "LEAST_UNITS", 5],
    ["¿Qué productos no vendí este mes?", "NO_SALES", 8],
    ["¿Qué productos facturaron más?", "MOST_REVENUE", 5],
  ])("distingue el ranking comercial para %s", (question, ranking, limit) => {
    expect(planDeetaAiRequest(question, [{ role: "USER", content: question }])).toEqual({
      name: "get_product_sales_ranking",
      arguments: { kind: "CURRENT_MONTH", month: null, ranking, limit },
    });
  });

  it("mantiene producto, métrica y cambia el período en un follow-up", () => {
    const messages: AiConversationMessage[] = [
      { role: "USER", content: "¿Qué producto vendí menos?" },
      { role: "ASSISTANT", content: "Producto A." },
      { role: "USER", content: "¿Y el mes pasado?" },
    ];
    expect(planDeetaAiRequest(messages[2].content, messages)).toEqual({
      name: "get_product_sales_ranking",
      arguments: { kind: "PREVIOUS_MONTH", month: null, ranking: "LEAST_UNITS", limit: 1 },
    });
  });

  it("pide aclaración para una intención realmente ambigua", () => {
    expect(clarificationForAiQuestion("¿Cuál es mi peor producto?")).toContain("menos se vende");
    expect(clarificationForAiQuestion("¿Cuál es el producto menos vendido?")).toBeNull();
  });

  it.each([
    ["¿Cuánto vendí hoy?", "get_period_summary"],
    ["¿Vendí más este mes?", "get_period_summary"],
    ["¿Qué producto vendo más?", "get_top_product_analysis"],
    ["¿Qué producto vendo menos?", "get_product_sales_ranking"],
    ["¿Qué día vendo más?", "get_sales_patterns"],
    ["¿En qué horario vendo más?", "get_sales_patterns"],
    ["¿Qué producto me deja más margen?", "getProductProfitability"],
    ["¿Cuál deja menos margen?", "getProductProfitability"],
    ["¿Por qué bajó mi margen?", "get_period_summary"],
    ["¿Cuánto gasté?", "get_expense_breakdown"],
    ["¿En qué gasté más?", "get_expense_breakdown"],
    ["¿Qué gasto aumentó?", "get_expense_breakdown"],
    ["¿Qué tengo sin stock?", "get_inventory_analysis"],
    ["¿Qué tiene poco stock?", "get_inventory_analysis"],
    ["¿Qué debería reponer?", "get_inventory_analysis"],
    ["¿Qué tengo de más?", "get_inventory_analysis"],
    ["¿Qué casi no se vende?", "get_inventory_analysis"],
    ["¿Qué no vendí?", "get_product_sales_ranking"],
    ["¿Qué se mueve más?", "get_top_product_analysis"],
    ["¿Cómo viene mi caja?", "get_cash_summary"],
    ["¿Cómo viene mi negocio?", "get_business_period_analysis"],
    ["¿Qué debería revisar?", "get_business_period_analysis"],
    ["¿Por qué vendo más pero gano menos?", "get_period_summary"],
    ["Haceme un análisis completo.", "get_business_period_analysis"],
  ])("cubre la pregunta comercial %s", (question, toolName) => {
    expect(planDeetaAiRequest(question, [{ role: "USER", content: question }])).toMatchObject({ name: toolName });
  });

  it("mantiene el contexto de caja en un follow-up", () => {
    const messages: AiConversationMessage[] = [
      { role: "USER", content: "¿Cómo viene mi caja?" },
      { role: "ASSISTANT", content: "La caja está abierta." },
      { role: "USER", content: "¿Hubo diferencias?" },
    ];
    expect(planDeetaAiRequest(messages[2].content, messages)).toEqual({ name: "get_cash_summary", arguments: {} });
  });

  it("interpreta rangos de fechas explícitos sin cambiar el default de otras preguntas", () => {
    expect(planDeetaAiRequest("¿Cuánto vendí del 01/09/2026 al 15/09/2026?", [])).toEqual({
      name: "get_period_summary",
      arguments: { kind: "CUSTOM_RANGE", month: null, start: "2026-09-01", end: "2026-09-15" },
    });
    expect(planDeetaAiRequest("¿Cuánto vendí?", [])).toEqual({
      name: "get_period_summary",
      arguments: { kind: "CURRENT_MONTH", month: null },
    });
  });

  it("deja preguntas abiertas al tool calling controlado", () => {
    expect(planDeetaAiRequest("¿Qué decisión debería tomar primero?", [])).toBeUndefined();
  });
});
