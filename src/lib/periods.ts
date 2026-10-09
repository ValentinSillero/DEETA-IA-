export type AnalysisPeriod = "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CURRENT_MONTH" | "PREVIOUS_MONTH";

export type DateRange = { start: string; end: string };
export type AiPeriodKind = "TODAY" | "YESTERDAY" | "CURRENT_WEEK" | "PREVIOUS_WEEK" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CURRENT_MONTH" | "PREVIOUS_MONTH" | "CURRENT_YEAR" | "SPECIFIC_MONTH" | "CUSTOM_RANGE";
export type AiPeriodSelection = { kind: AiPeriodKind; month: string | null; start?: string | null; end?: string | null };

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

function startOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function startOfWeek(value: string) {
  const weekday = parseDate(value).getUTCDay();
  return addDays(value, -((weekday + 6) % 7));
}

function previousMonthStart(value: string) {
  const date = parseDate(startOfMonth(value));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return iso(date);
}

function monthEnd(monthStart: string) {
  const date = parseDate(monthStart);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return iso(date);
}

export function resolveAnalysisPeriod(today: string, period: AnalysisPeriod): { current: DateRange; previous: DateRange } {
  if (period === "TODAY") return { current: { start: today, end: today }, previous: { start: addDays(today, -1), end: addDays(today, -1) } };
  if (period === "LAST_7_DAYS") return {
    current: { start: addDays(today, -6), end: today },
    previous: { start: addDays(today, -13), end: addDays(today, -7) },
  };
  if (period === "LAST_30_DAYS") return {
    current: { start: addDays(today, -29), end: today },
    previous: { start: addDays(today, -59), end: addDays(today, -30) },
  };
  const thisMonth = startOfMonth(today);
  const previousStart = previousMonthStart(today);
  if (period === "CURRENT_MONTH") {
    const elapsedDays = parseDate(today).getUTCDate() - 1;
    const comparableEnd = addDays(previousStart, elapsedDays);
    return {
      current: { start: thisMonth, end: today },
      previous: { start: previousStart, end: comparableEnd > monthEnd(previousStart) ? monthEnd(previousStart) : comparableEnd },
    };
  }
  const beforePreviousStart = previousMonthStart(previousStart);
  return {
    current: { start: previousStart, end: monthEnd(previousStart) },
    previous: { start: beforePreviousStart, end: monthEnd(beforePreviousStart) },
  };
}

export function resolveCustomPeriod(today: string, start: string, end: string): { current: DateRange; previous: DateRange } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error("INVALID_PERIOD");
  const days = Math.floor((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000) + 1;
  if (days < 1 || days > 366 || end > today) throw new Error("INVALID_PERIOD");
  return {
    current: { start, end },
    previous: { start: addDays(start, -days), end: addDays(start, -1) },
  };
}

export function resolveAiPeriod(today: string, selection: AiPeriodSelection): { current: DateRange; previous: DateRange } {
  if (selection.kind === "TODAY") return resolveAnalysisPeriod(today, "TODAY");
  if (selection.kind === "LAST_7_DAYS") return resolveAnalysisPeriod(today, "LAST_7_DAYS");
  if (selection.kind === "CURRENT_MONTH") return resolveAnalysisPeriod(today, "CURRENT_MONTH");
  if (selection.kind === "PREVIOUS_MONTH") return resolveAnalysisPeriod(today, "PREVIOUS_MONTH");
  if (selection.kind === "YESTERDAY") {
    const yesterday = addDays(today, -1);
    return { current: { start: yesterday, end: yesterday }, previous: { start: addDays(today, -2), end: addDays(today, -2) } };
  }
  if (selection.kind === "CURRENT_WEEK") {
    const currentStart = startOfWeek(today);
    const elapsedDays = Math.floor((parseDate(today).getTime() - parseDate(currentStart).getTime()) / 86_400_000);
    const previousStart = addDays(currentStart, -7);
    return {
      current: { start: currentStart, end: today },
      previous: { start: previousStart, end: addDays(previousStart, elapsedDays) },
    };
  }
  if (selection.kind === "PREVIOUS_WEEK") {
    const currentStart = addDays(startOfWeek(today), -7);
    return {
      current: { start: currentStart, end: addDays(currentStart, 6) },
      previous: { start: addDays(currentStart, -7), end: addDays(currentStart, -1) },
    };
  }
  if (selection.kind === "LAST_30_DAYS") {
    return resolveAnalysisPeriod(today, "LAST_30_DAYS");
  }
  if (selection.kind === "CURRENT_YEAR") {
    const year = today.slice(0, 4);
    const previousYear = String(Number(year) - 1);
    const currentStart = `${year}-01-01`;
    const elapsedDays = Math.floor((parseDate(today).getTime() - parseDate(currentStart).getTime()) / 86_400_000);
    return {
      current: { start: currentStart, end: today },
      previous: { start: `${previousYear}-01-01`, end: addDays(`${previousYear}-01-01`, elapsedDays) },
    };
  }
  if (selection.kind === "CUSTOM_RANGE") {
    if (!selection.start || !selection.end) throw new Error("INVALID_AI_PERIOD");
    return resolveCustomPeriod(today, selection.start, selection.end);
  }
  const month = selection.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month) || month > today.slice(0, 7)) throw new Error("INVALID_AI_PERIOD");
  const currentStart = `${month}-01`;
  const currentEnd = month === today.slice(0, 7) ? today : monthEnd(currentStart);
  const previousStart = previousMonthStart(currentStart);
  const elapsedDays = parseDate(currentEnd).getUTCDate() - 1;
  const comparableEnd = addDays(previousStart, elapsedDays);
  return {
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: comparableEnd > monthEnd(previousStart) ? monthEnd(previousStart) : comparableEnd },
  };
}
