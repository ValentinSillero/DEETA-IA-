import "server-only";

import { can, getActiveMembership } from "@/data/membership";
import type { Permission } from "@/lib/permissions";

export const FORBIDDEN_MESSAGE = "Tu rol en este negocio no permite hacer esta acción.";

// Primera barrera de cada server action o endpoint. La segunda está en el SQL,
// que vuelve a filtrar por los roles que tienen el permiso.
export async function permissionDenied(userId: string, permission: Permission): Promise<string | null> {
  return can(await getActiveMembership(userId), permission) ? null : FORBIDDEN_MESSAGE;
}

export async function forbiddenResponse(userId: string, permission: Permission): Promise<Response | null> {
  const denied = await permissionDenied(userId, permission);
  return denied ? Response.json({ message: denied }, { status: 403 }) : null;
}
