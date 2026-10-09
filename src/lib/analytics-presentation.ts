import type { AnalysisPeriod } from "@/lib/periods";

type AnalysisSummaryInput = {
  operations: number;
  grossMarginCents: number;
  expensesCents: number;
  estimatedResultCents: number;
  reference?: string;
  comparisons: {
    sales: number | null;
    expenses: number | null;
    estimatedResult: number | null;
  };
};

function direction(value: number | null) {
  if (value === null || value === 0) return 0;
  return value > 0 ? 1 : -1;
}

export function buildAnalysisSummary(input: AnalysisSummaryInput) {
  if (input.operations === 0) {
    return ["Todavía no hay ventas registradas en este período."];
  }

  const messages: string[] = [];
  const sales = direction(input.comparisons.sales);
  const expenses = direction(input.comparisons.expenses);
  const result = direction(input.comparisons.estimatedResult);
  const reference = input.reference ?? "el período anterior";
  const expensesGrewFaster = input.comparisons.expenses !== null
    && input.comparisons.sales !== null
    && input.comparisons.expenses > input.comparisons.sales + 10;

  if (sales > 0 && result > 0) {
    messages.push(expenses > 0
      ? `Vendiste más que ${reference} y el resultado también mejoró, aunque los gastos subieron.`
      : `Vendiste más que ${reference} y el resultado también mejoró.`);
  } else if (sales > 0 && result < 0) {
    messages.push(expenses > 0
      ? `Vendiste más que ${reference}, pero tus gastos ${expensesGrewFaster ? "crecieron mucho más" : "también aumentaron"}.`
      : `Vendiste más que ${reference}, pero el resultado fue menor.`);
    messages.push(`Por eso tu resultado estimado fue menor que ${reference}.`);
  } else if (sales < 0 && result > 0) {
    messages.push(`Vendiste menos que ${reference}, pero el resultado mejoró.`);
  } else if (sales < 0 && result < 0) {
    messages.push(`Las ventas y el resultado fueron menores que ${reference}.`);
  } else if (sales > 0) {
    messages.push(`Vendiste más que ${reference} y el resultado se mantuvo estable.`);
  } else if (sales < 0) {
    messages.push(`Vendiste menos que ${reference} y el resultado se mantuvo estable.`);
  } else if (input.comparisons.sales === 0) {
    messages.push(`Las ventas se mantuvieron similares a ${reference}.`);
  } else {
    messages.push("Este período ya tiene ventas, pero todavía no hay datos anteriores suficientes para compararlo.");
  }

  if (messages.length < 2 && input.estimatedResultCents < 0 && input.expensesCents > input.grossMarginCents) {
    messages.push("Tus gastos fueron mayores que lo que te quedó de las ventas.");
  } else if (expenses > 0 && !(sales > 0 && result !== 0)) {
    messages.push("Tus gastos aumentaron frente al período anterior.");
  } else if (expenses < 0 && result >= 0) {
    messages.push("Tus gastos bajaron frente al período anterior.");
  }

  return messages.slice(0, 2);
}

export function comparisonLabel(period: AnalysisPeriod | "CUSTOM") {
  return `Comparando con ${comparisonReference(period)}`;
}

export function comparisonReference(period: AnalysisPeriod | "CUSTOM") {
  if (period === "TODAY") return "ayer";
  if (period === "LAST_7_DAYS") return "los 7 días anteriores";
  if (period === "LAST_30_DAYS") return "los 30 días anteriores";
  if (period === "CURRENT_MONTH") return "el mes pasado";
  if (period === "PREVIOUS_MONTH") return "el mes anterior al seleccionado";
  return "un período anterior de la misma duración";
}

export function comparisonChangeText(value: number | null, reference = "el período anterior") {
  if (value === null) return "Sin período anterior";
  if (Math.abs(value) < 0.5) return "Sin cambios relevantes";
  const amount = Math.abs(value).toLocaleString("es-AR", { maximumFractionDigits: 1 });
  return `${amount}% vs. ${reference.replace(/^el\s+/i, "")}`;
}

type MetricExplanationInput = {
  key: "sales" | "grossMargin" | "expenses" | "estimatedResult" | "averageTicket";
  currentCents: number;
  change: number | null;
  reference: string;
};

export function metricExplanation({ key, currentCents, change, reference }: MetricExplanationInput) {
  if (change === null) {
    if (key === "estimatedResult") return currentCents < 0 ? "El resultado del período fue negativo." : "El resultado del período fue positivo.";
    return "Todavía no hay datos para comparar.";
  }
  if (Math.abs(change) < 0.5) return key === "expenses" || key === "sales" ? "Se mantuvieron similares." : "Se mantuvo similar.";

  const increased = change > 0;
  const large = Math.abs(change) >= 25;
  if (key === "sales") return `Vendiste ${increased ? "más" : "menos"} que ${reference}.`;
  if (key === "grossMargin") {
    if (large) return increased ? "Mejoró mucho." : "Empeoró mucho.";
    if (Math.abs(change) < 10) return increased ? "Mejoró levemente." : "Bajó levemente.";
    return increased ? "Mejoró." : "Empeoró.";
  }
  if (key === "expenses") {
    const relativeReference = reference.startsWith("el ") ? `del ${reference.slice(3)}` : `de ${reference}`;
    if (large) return `${increased ? "Subieron mucho" : "Bajaron mucho"} respecto ${relativeReference}.`;
    return `${increased ? "Subieron" : "Bajaron"} respecto ${relativeReference}.`;
  }
  if (key === "estimatedResult") {
    return `Te quedó ${large ? "bastante " : ""}${increased ? "más" : "menos"} que ${reference}.`;
  }
  return `Cada venta fue ${increased ? "mayor" : "menor"} que ${reference}.`;
}

export function formatAnalysisMoney(cents: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);
}
