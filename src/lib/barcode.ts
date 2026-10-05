export type ScannedBarcode = { value: string; format: string };

export function normalizeBarcode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function isValidBarcode(value: string) {
  const normalized = normalizeBarcode(value);
  return normalized.length > 0 && normalized.length <= 80 && /^[\x21-\x7E]+$/.test(normalized);
}

export function canAcceptDetectedCode(
  previous: { value: string; seenAt: number } | null,
  value: string,
  now: number,
  cooldownMs = 2_500,
) {
  return !previous || previous.value !== value || now - previous.seenAt >= cooldownMs;
}

export function scannedQuantity(currentQuantity: number, availableStock: number) {
  if (currentQuantity >= availableStock) return { quantity: currentQuantity, added: false };
  return { quantity: currentQuantity + 1, added: true };
}

export function pairingTokenFromValue(value: string) {
  try {
    const url = new URL(value);
    return url.searchParams.get("token")?.trim() || null;
  } catch {
    const trimmed = value.trim();
    return /^[A-Za-z0-9_-]{32,}$/.test(trimmed) ? trimmed : null;
  }
}
