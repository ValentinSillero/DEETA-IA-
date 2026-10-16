import "server-only";

import { cache } from "react";

import { getSqlClient } from "@/db";
import type { MemberRole } from "@/db/schema";
import { effectiveRole, hasPermission, permissionsFor, type AssignableRole, type Permission } from "@/lib/permissions";

// Flujo de autorización de DEETA:
// sesión → usuario → negocio activo (membresía is_current) → rol → permiso.
// El negocio y el rol salen siempre de la base, nunca del navegador.

export type ActiveMembership = {
  userId: string;
  businessId: string;
  businessName: string;
  timezone: string;
  role: MemberRole;
  roleLabelKey: AssignableRole;
  permissions: ReadonlySet<Permission>;
};

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`FORBIDDEN:${permission}`);
    this.name = "ForbiddenError";
  }
}

// Una consulta por request (React cache). No se cachea entre requests: un
// cambio de rol se aplica en la siguiente navegación o acción.
export const getActiveMembership = cache(async (userId: string): Promise<ActiveMembership | null> => {
  const sql = getSqlClient();
  const rows = await sql`
    select am.business_id, am.role, b.name, b.timezone
    from active_membership am
    inner join business b on b.id = am.business_id
    where am.user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const role = String(row.role) as MemberRole;
  return {
    userId,
    businessId: String(row.business_id),
    businessName: String(row.name),
    timezone: String(row.timezone),
    role,
    roleLabelKey: effectiveRole(role),
    permissions: new Set(permissionsFor(role)),
  };
});

export function can(membership: Pick<ActiveMembership, "role"> | null | undefined, permission: Permission) {
  return hasPermission(membership?.role, permission);
}

export async function hasPermissionForUser(userId: string, permission: Permission) {
  return can(await getActiveMembership(userId), permission);
}

export async function requirePermission(userId: string, permission: Permission) {
  const membership = await getActiveMembership(userId);
  if (!membership || !can(membership, permission)) throw new ForbiddenError(permission);
  return membership;
}

export type MembershipOption = { businessId: string; businessName: string; role: MemberRole; isCurrent: boolean };

export const getMembershipsForUser = cache(async (userId: string): Promise<MembershipOption[]> => {
  const sql = getSqlClient();
  const rows = await sql`
    select bm.business_id, bm.role, bm.is_current, b.name
    from business_member bm
    inner join business b on b.id = bm.business_id
    where bm.user_id = ${userId}
    order by bm.is_current desc, b.name asc
  `;
  return rows.map((row) => ({
    businessId: String(row.business_id),
    businessName: String(row.name),
    role: String(row.role) as MemberRole,
    isCurrent: Boolean(row.is_current),
  }));
});

// Cambia el negocio activo solo si la persona pertenece al negocio elegido.
export async function switchActiveBusinessForUser(userId: string, businessId: string) {
  const sql = getSqlClient();
  const target = await sql`select 1 from business_member where user_id = ${userId} and business_id = ${businessId} limit 1`;
  if (!target[0]) return false;
  await sql.transaction([
    sql`update business_member set is_current = false, updated_at = now() where user_id = ${userId} and is_current and business_id <> ${businessId}`,
    sql`update business_member set is_current = true, updated_at = now() where user_id = ${userId} and business_id = ${businessId}`,
  ]);
  return true;
}
