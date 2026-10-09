import type { AiConversationMessage, AiPreparedTool } from "@/lib/ai/types";

type PeriodKind = "TODAY" | "YESTERDAY" | "CURRENT_WEEK" | "PREVIOUS_WEEK" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CURRENT_MONTH" | "PREVIOUS_MONTH" | "CURRENT_YEAR";

function periodFromQuestion(question: string): PeriodKind {
  if (/\bayer\b/i.test(question)) return "YESTERDAY";
  if (/\bhoy\b/i.test(question)) return "TODAY";
  if (/\bsemana\s+pasada\b/i.test(question)) return "PREVIOUS_WEEK";
  if (/\besta\s+semana\b/i.test(question)) return "CURRENT_WEEK";
  if (/\b[uú]ltima\s+semana\b/i.test(question)) return "LAST_7_DAYS";
  if (/\b(?:7|siete)\s+d[ií]as\b/i.test(question)) return "LAST_7_DAYS";
  if (/\b(?:30|treinta)\s+d[ií]as\b/i.test(question)) return "LAST_30_DAYS";
  if (/\bmes\s+pasado\b/i.test(question)) return "PREVIOUS_MONTH";
  if (/\b(?:este|el)\s+a[nñ]o\b|\banu(?:al|ales)\b/i.test(question)) return "CURRENT_YEAR";
  return "CURRENT_MONTH";
}

function periodArguments(question: string) {
  const isoRange = question.match(/(\d{4}-\d{2}-\d{2})\s*(?:al|a|hasta|—|–)\s*(\d{4}-\d{2}-\d{2})/i);
  if (isoRange) return { kind: "CUSTOM_RANGE" as const, month: null, start: isoRange[1], end: isoRange[2] };
  const localRange = question.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*(?:al|a|hasta|—|–)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i);
  if (localRange) {
    const iso = (day: string, month: string, year: string) => `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return { kind: "CUSTOM_RANGE" as const, month: null, start: iso(localRange[1], localRange[2], localRange[3]), end: iso(localRange[4], localRange[5], localRange[6]) };
  }
  return { kind: periodFromQuestion(question), month: null };
}

function productReferenceFromQuestion(question: string) {
  const match = question.match(/(?:cu[aá]nto\s+(?:margen\s+me\s+deja|vend[ií]\s+de|stock\s+(?:tengo\s+)?de)|c[oó]mo\s+le\s+fue\s+a)\s+["“”']?(.+?)["“”']?\s*[?.!]*$/i);
  const reference = match?.[1]?.trim().replace(/\s+(?:este mes|el mes pasado|hoy|ayer)$/i, "");
  return reference && !/^(?:ese|este|aquel)(?:\s+producto)?$/i.test(reference) ? reference : undefined;
}

const topProductPattern = /(?:qu[eé]|cu[aá]l).{0,24}producto.{0,48}(?:vendo|vendido|vende).{0,24}m[aá]s|producto.{0,48}(?:m[aá]s vendido|vendo m[aá]s|vende m[aá]s)|(?:producto|productos).{0,30}(?:m[aá]s salida|m[aá]s movimiento)|qu[eé].{0,20}se mueve m[aá]s/i;
const leastProductPattern = /(?:qu[eé]|cu[aá]l).{0,30}producto.{0,50}(?:vendo|vend[ií]|vendido|vende).{0,20}menos|producto.{0,50}(?:menos vendido|vendo menos|vende menos|menor venta)|producto.{0,40}menos (?:ventas|movimiento en ventas)/i;
const noSalesPattern = /(?:producto|productos).{0,40}(?:no vend[ií]|sin ventas)|qu[eé].{0,30}no (?:vend[ií]|se vendi[oó])|qu[eé]\s+no\s+vend[ií]/i;
const mostRevenuePattern = /(?:producto|productos).{0,40}(?:(?:m[aá]s|mayor).{0,15}(?:factur|ingres)|(?:factur|ingres).{0,15}m[aá]s)/i;
const leastRevenuePattern = /(?:producto|productos).{0,40}(?:(?:menos|menor).{0,15}(?:factur|ingres)|(?:factur|ingres).{0,15}menos)/i;

export function clarificationForAiQuestion(question: string) {
  if (/\b(?:peor|mejor)\s+producto\b/i.test(question)
    && !/(?:vend|margen|rentab|stock|rotaci[oó]n|factur|ingres)/i.test(question)) {
    return "¿Te referís al producto que menos se vende, al de menor margen o al que tiene menor rotación?";
  }
  return null;
}

function previousUserQuestions(question: string, messages: AiConversationMessage[]) {
  const questions = messages
    .filter((message) => message.role === "USER")
    .map((message) => message.content);
  if (questions.at(-1) === question) questions.pop();
  return questions.slice(-3);
}

export function planDeetaAiRequest(question: string, messages: AiConversationMessage[]): AiPreparedTool | undefined {
  const normalized = question.toLocaleLowerCase("es");
  const previousQuestions = previousUserQuestions(question, messages);
  const period = periodArguments(question);
  const topProductQuestion = previousQuestions.findLast((item) => topProductPattern.test(item));
  const leastProductQuestion = previousQuestions.findLast((item) => leastProductPattern.test(item));
  const noSalesQuestion = previousQuestions.findLast((item) => noSalesPattern.test(item));
  const cashQuestion = previousQuestions.findLast((item) => /\b(?:caja|efectivo esperado)\b/i.test(item));
  const requestedProductLimit = /\bproductos\b/.test(normalized) ? 5 : 1;
  const productReference = productReferenceFromQuestion(question);

  if (/(?:analiz|an[aá]lisis).*(?:negocio)|an[aá]lisis completo|(?:c[oó]mo|qu[eé] tal|qu[eé] pas[oó]).*(?:negocio)|qu[eé].*(?:deber[ií]a|conviene).*(?:mejorar|revisar)/.test(normalized)) {
    return { name: "get_business_period_analysis", arguments: period };
  }

  if (/\b(?:caja|efectivo esperado|efectivo en caja)\b|cu[aá]nto cobr[eé] en efectivo/.test(normalized)
    || (cashQuestion && /(?:hubo|hay|tuve).{0,20}diferencia|cu[aá]nto deber[ií]a haber/.test(normalized))) {
    return { name: "get_cash_summary", arguments: {} };
  }
  if (productReference) {
    return { name: "get_product_performance", arguments: { productReference, ...period } };
  }
  if (/\b(?:reponer|reposici[oó]n|comprar stock)\b/.test(normalized)) {
    return { name: "get_inventory_analysis", arguments: { focus: "REORDER", days: 30 } };
  }
  if (noSalesPattern.test(normalized)) {
    return { name: "get_product_sales_ranking", arguments: { ...period, ranking: "NO_SALES", limit: /\bproductos\b/.test(normalized) ? 8 : 1 } };
  }
  if (leastProductPattern.test(normalized)) {
    return { name: "get_product_sales_ranking", arguments: { ...period, ranking: "LEAST_UNITS", limit: requestedProductLimit } };
  }
  if (mostRevenuePattern.test(normalized)) {
    return { name: "get_product_sales_ranking", arguments: { ...period, ranking: "MOST_REVENUE", limit: requestedProductLimit } };
  }
  if (leastRevenuePattern.test(normalized)) {
    return { name: "get_product_sales_ranking", arguments: { ...period, ranking: "LEAST_REVENUE", limit: requestedProductLimit } };
  }
  if (/(?:casi no|poco|lento).*(?:vende|venden|venta)|baja rotaci[oó]n/.test(normalized)) {
    return { name: "get_inventory_analysis", arguments: { focus: "SLOW", days: 30 } };
  }
  if (/(?:demasiado|mucho|exceso).*(?:stock|inventario)|stock.*(?:sobrante|exceso)|qu[eé] tengo de m[aá]s/.test(normalized)) {
    return { name: "get_inventory_analysis", arguments: { focus: "EXCESS", days: 30 } };
  }
  if (/\b(?:sin stock|agotad[oa]s?)\b/.test(normalized)) {
    return { name: "get_inventory_analysis", arguments: { focus: "OUT_OF_STOCK", days: 30 } };
  }
  if (/(?:debajo|por debajo|bajo).{0,12}(?:del?\s+)?m[ií]nimo/.test(normalized)) {
    return { name: "get_inventory_analysis", arguments: { focus: "BELOW_MINIMUM", days: 30 } };
  }
  if (/(?:qu[eé]|cu[aá]l).*(?:producto).*(?:menos|menor) stock/.test(normalized)) {
    return { name: "get_inventory_analysis", arguments: { focus: "LOWEST_STOCK", days: 30 } };
  }
  if (/\b(?:stock bajo|poco stock|faltante)\b/.test(normalized)) {
    return { name: "get_inventory_analysis", arguments: { focus: "LOW_STOCK", days: 30 } };
  }
  if (/(?:gasto|gastos|gast[eé]|gastaste)/.test(normalized)) {
    return { name: "get_expense_breakdown", arguments: period };
  }
  if (/(?:qu[eé]|cu[aá]l).*(?:producto)?.*(?:m[aá]s margen|rentable|rentabilidad|mayor porcentaje de margen)|producto.{0,30}mayor margen|cu[aá]l deja m[aá]s margen/.test(normalized)) {
    return { name: "getProductProfitability", arguments: period };
  }
  if (/(?:qu[eé]|cu[aá]l).*(?:producto)?.*(?:menos|menor|poco) margen|producto.{0,30}(?:menor|menos) margen|cu[aá]l deja menos margen/.test(normalized)) {
    return { name: "getProductProfitability", arguments: period };
  }
  if (topProductPattern.test(normalized)) {
    if (/\bproductos\b/.test(normalized)) {
      return { name: "get_product_sales_ranking", arguments: { ...period, ranking: "MOST_UNITS", limit: 5 } };
    }
    return { name: "get_top_product_analysis", arguments: period };
  }
  if (topProductQuestion && /(?:cu[aá]nto|qu[eé]).*(?:margen|stock|vend)|c[oó]mo.*vend(?:i[oó]|ió)|mes pasado/.test(normalized)) {
    return { name: "get_top_product_analysis", arguments: periodArguments(/mes pasado/.test(normalized) ? question : topProductQuestion) };
  }
  if (leastProductQuestion && /(?:cu[aá]nto|qu[eé]).*(?:stock|vend)|mes pasado/.test(normalized)) {
    return { name: "get_product_sales_ranking", arguments: { ...periodArguments(/mes pasado/.test(normalized) ? question : leastProductQuestion), ranking: "LEAST_UNITS", limit: /\bproductos\b/i.test(leastProductQuestion) ? 5 : 1 } };
  }
  if (noSalesQuestion && /(?:cu[aá]nto|qu[eé]).*(?:stock|vend)|mes pasado/.test(normalized)) {
    return { name: "get_product_sales_ranking", arguments: { ...periodArguments(/mes pasado/.test(normalized) ? question : noSalesQuestion), ranking: "NO_SALES", limit: /\bproductos\b/i.test(noSalesQuestion) ? 8 : 1 } };
  }
  if (/(?:qu[eé]|cu[aá]l).*(?:d[ií]a|d[ií]as).*(?:vendo|vende).*(?:m[aá]s)|d[ií]as? fuertes?/.test(normalized)) {
    return { name: "get_sales_patterns", arguments: { ...period, focus: "DAYS" } };
  }
  if (/(?:qu[eé]|cu[aá]l|en).*(?:hora|horario|franja).*(?:vendo|vende|m[aá]s)|horarios? fuertes?/.test(normalized)) {
    return { name: "get_sales_patterns", arguments: { ...period, focus: "HOURS" } };
  }
  if (/\b(?:tendencia|evoluci[oó]n)\b/.test(normalized)) {
    return { name: "get_sales_patterns", arguments: { ...period, focus: "TREND" } };
  }
  if (!/\bproducto\b/.test(normalized) && /(?:cu[aá]nto).*(?:vend[ií]|ventas)|cu[aá]ntas ventas|promedio por venta|ticket (?:medio|promedio)|compar(?:á|a|ame).*(?:mes|ventas)|vend(?:í|i|o|iendo).*(?:m[aá]s)|(?:c[oó]mo|qu[eé] tal).*(?:ventas|viene|fue)|resultado|margen(?: bruto)?|estoy ganando|(?:este|el) mes fue mejor/.test(normalized)) {
    return { name: "get_period_summary", arguments: period };
  }
  return undefined;
}
