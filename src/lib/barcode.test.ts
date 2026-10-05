import { describe, expect, it } from "vitest";

import { canAcceptDetectedCode, normalizeBarcode, pairingTokenFromValue, scannedQuantity } from "@/lib/barcode";
import { hashPairingToken, pairingCanConnect } from "@/lib/pairing";

describe("lector de códigos", () => {
  it("normaliza un código comercial", () => expect(normalizeBarcode(" 779 123 ")).toBe("779123"));
  it("agrega la primera lectura y una segunda lectura intencional", () => {
    expect(scannedQuantity(0, 10)).toEqual({ quantity: 1, added: true });
    expect(scannedQuantity(1, 10)).toEqual({ quantity: 2, added: true });
  });
  it("no supera el stock", () => expect(scannedQuantity(2, 2)).toEqual({ quantity: 2, added: false }));
  it("ignora una repetición accidental y acepta luego del cooldown", () => {
    const previous = { value: "779123", seenAt: 1_000 };
    expect(canAcceptDetectedCode(previous, "779123", 2_000)).toBe(false);
    expect(canAcceptDetectedCode(previous, "779123", 3_600)).toBe(true);
  });
  it("extrae el token de un QR de conexión", () => {
    expect(pairingTokenFromValue("https://deeta.test/scanner/conectar?token=abc_def-12345678901234567890123456789012")).toBe("abc_def-12345678901234567890123456789012");
  });
});

describe("pairing", () => {
  it("no guarda el token en texto plano", () => expect(hashPairingToken("token-secreto")).not.toContain("token-secreto"));
  it("rechaza tokens vencidos o revocados", () => {
    expect(pairingCanConnect("WAITING", new Date(Date.now() + 60_000))).toBe(true);
    expect(pairingCanConnect("WAITING", new Date(Date.now() - 1))).toBe(false);
    expect(pairingCanConnect("REVOKED", new Date(Date.now() + 60_000))).toBe(false);
  });
});
