"use server";

import { cookies } from "next/headers";

import {
  connectPairingForUser,
  createPairingForUser,
  findProductByBarcodeForUser,
  getPairingForMobileUser,
  revokePairingForMobileUser,
  revokePairingForPcUser,
  sendRemoteScanForUser,
} from "@/data/scanner";
import { pairingCookieName } from "@/lib/pairing";
import { connectPairingSchema, createPairingSchema, lookupBarcodeSchema, pairingIdSchema, remoteScanSchema } from "@/lib/scanner-validations";
import { requireSession } from "@/lib/session";

export async function lookupBarcodeAction(raw: unknown) {
  const session = await requireSession();
  const parsed = lookupBarcodeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, reason: "INVALID" as const };
  const product = await findProductByBarcodeForUser(session.user.id, parsed.data.barcode);
  return product ? { ok: true as const, product } : { ok: false as const, reason: "NOT_FOUND" as const, barcode: parsed.data.barcode };
}

export async function createPairingAction(raw: unknown) {
  const session = await requireSession();
  const parsed = createPairingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "No pudimos iniciar la conexión." };
  try {
    const result = await createPairingForUser(session.user.id, parsed.data.targetCartId);
    return result ? { ok: true as const, ...result } : { ok: false as const, message: "No encontramos tu negocio." };
  } catch (error) {
    console.error("No se pudo crear el pairing", error);
    return { ok: false as const, message: "No pudimos iniciar la conexión." };
  }
}

export async function connectPairingAction(raw: unknown) {
  const session = await requireSession();
  const parsed = connectPairingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "El código de conexión no es válido." };
  const pairing = await connectPairingForUser(session.user.id, parsed.data.token);
  if (!pairing) return { ok: false as const, message: "La conexión venció o pertenece a otro negocio." };
  const cookieStore = await cookies();
  cookieStore.set(pairingCookieName(pairing.id), parsed.data.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: `/scanner/remoto/${pairing.id}`,
    expires: pairing.expiresAt,
  });
  return { ok: true as const, pairingId: pairing.id };
}

export async function sendRemoteScanAction(raw: unknown) {
  const session = await requireSession();
  const parsed = remoteScanSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, reason: "INVALID_SCAN" as const };
  const token = (await cookies()).get(pairingCookieName(parsed.data.pairingId))?.value;
  if (!token) return { ok: false as const, reason: "INVALID_PAIRING" as const };
  return sendRemoteScanForUser(session.user.id, token, parsed.data);
}

export async function revokePcPairingAction(raw: unknown) {
  const session = await requireSession();
  const parsed = pairingIdSchema.safeParse(raw);
  return parsed.success && await revokePairingForPcUser(session.user.id, parsed.data);
}

export async function revokeMobilePairingAction(raw: unknown) {
  const session = await requireSession();
  const parsed = pairingIdSchema.safeParse(raw);
  if (!parsed.success) return false;
  const cookieStore = await cookies();
  const name = pairingCookieName(parsed.data);
  const token = cookieStore.get(name)?.value;
  if (!token) return false;
  const revoked = await revokePairingForMobileUser(session.user.id, parsed.data, token);
  cookieStore.set(name, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: `/scanner/remoto/${parsed.data}`,
    maxAge: 0,
  });
  return revoked;
}

export async function validateMobilePairingForUser(pairingId: string) {
  const session = await requireSession();
  const parsed = pairingIdSchema.safeParse(pairingId);
  if (!parsed.success) return null;
  const token = (await cookies()).get(pairingCookieName(parsed.data))?.value;
  return token ? getPairingForMobileUser(session.user.id, parsed.data, token) : null;
}
