import { createHash, randomBytes } from "node:crypto";

export const PAIRING_QR_MINUTES = 5;
export const CONNECTED_PAIRING_HOURS = 8;
export const PAIRING_COOKIE_PREFIX = "deeta-scanner-";

export function createPairingToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPairingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function pairingExpiry(now = new Date(), minutes = PAIRING_QR_MINUTES) {
  return new Date(now.getTime() + minutes * 60_000);
}

export function connectedPairingExpiry(now = new Date()) {
  return new Date(now.getTime() + CONNECTED_PAIRING_HOURS * 60 * 60_000);
}

export function pairingCookieName(pairingId: string) {
  return `${PAIRING_COOKIE_PREFIX}${pairingId}`;
}

export function pairingCanConnect(status: string, expiresAt: Date, now = new Date()) {
  return (status === "WAITING" || status === "CONNECTED") && expiresAt.getTime() > now.getTime();
}
