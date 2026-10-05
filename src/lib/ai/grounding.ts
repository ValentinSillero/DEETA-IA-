function numericTokens(value: string) {
  return value.match(/\d+(?:[.,]\d+)*/g) ?? [];
}

function normalizeNumber(value: string) {
  const dotGroups = value.split(".");
  const withoutThousands = dotGroups.length > 2 || (dotGroups.length === 2 && dotGroups[1]?.length === 3)
    ? value.replaceAll(".", "")
    : value;
  const normalized = withoutThousands.replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? String(number) : normalized;
}

export function unsupportedNumericClaims(answer: string, evidence: unknown[]) {
  const supported = new Set(numericTokens(JSON.stringify(evidence)).map(normalizeNumber));
  return numericTokens(answer).map(normalizeNumber).filter((token) => !supported.has(token));
}
