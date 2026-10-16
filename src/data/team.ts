import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getSqlClient } from "@/db";
import type { MemberRole } from "@/db/schema";
import { getActiveMembership } from "@/data/membership";
import {
  hasPermission,
  invitationRoleIssue,
  teamRemovalIssue,
  teamRoleChangeIssue,
  type AssignableRole,
  type TeamChangeIssue,
} from "@/lib/permissions";

export const INVITATION_DAYS = 7;

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

// Registro de acciones sensibles. Nunca se guardan tokens, contraseñas ni secretos.
export async function recordAudit(entry: {
  businessId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const sql = getSqlClient();
  await sql`
    insert into audit_log (id, business_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (${crypto.randomUUID()}, ${entry.businessId}, ${entry.actorUserId}, ${entry.action}, ${entry.entityType}, ${entry.entityId ?? null}, ${JSON.stringify(entry.metadata ?? {})}::jsonb)
  `;
}

export type TeamMember = { userId: string; name: string; email: string; role: MemberRole; isSelf: boolean; joinedAt: Date };
export type TeamInvitation = { id: string; email: string; role: MemberRole; state: "PENDING" | "EXPIRED"; expiresAt: Date; invitedByName: string };

export async function getTeamForUser(userId: string) {
  const membership = await getActiveMembership(userId);
  if (!membership || !hasPermission(membership.role, "TEAM_VIEW")) return null;
  const sql = getSqlClient();
  const [memberRows, invitationRows] = await Promise.all([
    sql`
      select bm.user_id, bm.role, bm.created_at, u.name, u.email
      from business_member bm
      inner join "user" u on u.id = bm.user_id
      where bm.business_id = ${membership.businessId}
      order by case bm.role when 'OWNER' then 0 when 'ADMIN' then 1 when 'MANAGER' then 2 when 'EMPLOYEE' then 2 else 3 end, u.name
    `,
    sql`
      select i.id, i.email, i.role, i.expires_at, u.name as invited_by_name
      from business_invitation i
      inner join "user" u on u.id = i.invited_by
      where i.business_id = ${membership.businessId} and i.status = 'PENDING'
      order by i.created_at desc
      limit 50
    `,
  ]);
  return {
    membership,
    members: memberRows.map((row): TeamMember => ({
      userId: String(row.user_id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role) as MemberRole,
      isSelf: String(row.user_id) === userId,
      joinedAt: new Date(String(row.created_at)),
    })),
    invitations: invitationRows.map((row): TeamInvitation => ({
      id: String(row.id),
      email: String(row.email),
      role: String(row.role) as MemberRole,
      state: new Date(String(row.expires_at)).getTime() > Date.now() ? "PENDING" : "EXPIRED",
      expiresAt: new Date(String(row.expires_at)),
      invitedByName: String(row.invited_by_name),
    })),
  };
}

export type InvitationResult =
  | { ok: true; token: string; invitationId: string; expiresAt: Date }
  | { ok: false; reason: TeamChangeIssue | "ALREADY_MEMBER" | "NOT_FOUND" };

export async function createInvitationForUser(userId: string, input: { email: string; role: AssignableRole }): Promise<InvitationResult> {
  const membership = await getActiveMembership(userId);
  if (!membership) return { ok: false, reason: "FORBIDDEN" };
  // El rol se valida contra quien invita: nadie puede invitar a un rol mayor al permitido.
  const issue = invitationRoleIssue(membership.role, input.role);
  if (issue) return { ok: false, reason: issue };
  const email = input.email.trim().toLowerCase();
  const sql = getSqlClient();
  const already = await sql`
    select 1 from business_member bm inner join "user" u on u.id = bm.user_id
    where bm.business_id = ${membership.businessId} and lower(u.email) = ${email}
    limit 1
  `;
  if (already[0]) return { ok: false, reason: "ALREADY_MEMBER" };
  const token = newToken();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000);
  // Una invitación nueva invalida cualquier invitación pendiente anterior para ese email.
  await sql.transaction([
    sql`update business_invitation set status = 'CANCELLED', updated_at = now() where business_id = ${membership.businessId} and email = ${email} and status = 'PENDING'`,
    sql`
      insert into business_invitation (id, business_id, email, role, token_hash, expires_at, invited_by)
      values (${id}, ${membership.businessId}, ${email}, ${input.role}::member_role, ${hashInvitationToken(token)}, ${expiresAt.toISOString()}, ${userId})
    `,
  ]);
  await recordAudit({ businessId: membership.businessId, actorUserId: userId, action: "TEAM_INVITE", entityType: "invitation", entityId: id, metadata: { email, role: input.role } });
  return { ok: true, token, invitationId: id, expiresAt };
}

export async function regenerateInvitationForUser(userId: string, invitationId: string): Promise<InvitationResult> {
  const membership = await getActiveMembership(userId);
  if (!membership) return { ok: false, reason: "FORBIDDEN" };
  const sql = getSqlClient();
  const rows = await sql`select email, role from business_invitation where id = ${invitationId} and business_id = ${membership.businessId} and status = 'PENDING' limit 1`;
  if (!rows[0]) return { ok: false, reason: "NOT_FOUND" };
  return createInvitationForUser(userId, { email: String(rows[0].email), role: String(rows[0].role) as AssignableRole });
}

export async function cancelInvitationForUser(userId: string, invitationId: string) {
  const membership = await getActiveMembership(userId);
  if (!membership || !hasPermission(membership.role, "TEAM_INVITE")) return false;
  const sql = getSqlClient();
  const rows = await sql`
    update business_invitation set status = 'CANCELLED', updated_at = now()
    where id = ${invitationId} and business_id = ${membership.businessId} and status = 'PENDING'
      and (role <> 'OWNER' or ${hasPermission(membership.role, "OWNER_MANAGE")})
    returning id
  `;
  if (rows[0]) await recordAudit({ businessId: membership.businessId, actorUserId: userId, action: "TEAM_INVITE_CANCEL", entityType: "invitation", entityId: invitationId });
  return rows.length > 0;
}

async function teamTarget(businessId: string, targetUserId: string) {
  const sql = getSqlClient();
  const rows = await sql`
    select bm.role,
      (select count(*) from business_member o where o.business_id = ${businessId} and o.role = 'OWNER')::int as owner_count
    from business_member bm
    where bm.business_id = ${businessId} and bm.user_id = ${targetUserId}
    limit 1
  `;
  return rows[0] ? { role: String(rows[0].role) as MemberRole, ownerCount: Number(rows[0].owner_count) } : null;
}

export type TeamChangeResult = { ok: true } | { ok: false; reason: TeamChangeIssue | "NOT_FOUND" };

export async function changeMemberRoleForUser(userId: string, targetUserId: string, nextRole: AssignableRole): Promise<TeamChangeResult> {
  const membership = await getActiveMembership(userId);
  if (!membership) return { ok: false, reason: "FORBIDDEN" };
  const target = await teamTarget(membership.businessId, targetUserId);
  if (!target) return { ok: false, reason: "NOT_FOUND" };
  const issue = teamRoleChangeIssue({ actorRole: membership.role, actorUserId: userId, targetUserId, targetRole: target.role, nextRole, ownerCount: target.ownerCount });
  if (issue) return { ok: false, reason: issue };
  const sql = getSqlClient();
  // La condición del último dueño se repite en SQL para evitar carreras.
  const rows = await sql`
    update business_member bm set role = ${nextRole}::member_role, updated_at = now()
    where bm.business_id = ${membership.businessId} and bm.user_id = ${targetUserId}
      and (bm.role <> 'OWNER' or ${nextRole} = 'OWNER'
        or (select count(*) from business_member o where o.business_id = bm.business_id and o.role = 'OWNER') > 1)
    returning bm.id
  `;
  if (!rows[0]) return { ok: false, reason: "LAST_OWNER" };
  await recordAudit({ businessId: membership.businessId, actorUserId: userId, action: "TEAM_ROLE_CHANGE", entityType: "member", entityId: targetUserId, metadata: { from: target.role, to: nextRole } });
  return { ok: true };
}

export async function removeMemberForUser(userId: string, targetUserId: string): Promise<TeamChangeResult> {
  const membership = await getActiveMembership(userId);
  if (!membership) return { ok: false, reason: "FORBIDDEN" };
  const target = await teamTarget(membership.businessId, targetUserId);
  if (!target) return { ok: false, reason: "NOT_FOUND" };
  const issue = teamRemovalIssue({ actorRole: membership.role, actorUserId: userId, targetUserId, targetRole: target.role, ownerCount: target.ownerCount });
  if (issue) return { ok: false, reason: issue };
  const sql = getSqlClient();
  // Solo se quita la membresía: la cuenta y todo su historial (ventas, cajas,
  // movimientos) se conservan. Si era su negocio activo, pasa al siguiente.
  const [removed] = await sql.transaction([
    sql`
      delete from business_member bm
      where bm.business_id = ${membership.businessId} and bm.user_id = ${targetUserId}
        and (bm.role <> 'OWNER' or (select count(*) from business_member o where o.business_id = bm.business_id and o.role = 'OWNER') > 1)
      returning bm.id
    `,
    sql`
      update business_member set is_current = true, updated_at = now()
      where id = (
        select id from business_member where user_id = ${targetUserId}
        order by created_at asc limit 1
      ) and not exists (select 1 from business_member where user_id = ${targetUserId} and is_current)
    `,
  ]);
  if (!removed[0]) return { ok: false, reason: "LAST_OWNER" };
  await recordAudit({ businessId: membership.businessId, actorUserId: userId, action: "TEAM_REMOVE", entityType: "member", entityId: targetUserId, metadata: { role: target.role } });
  return { ok: true };
}

export type InvitationView = {
  id: string;
  businessId: string;
  businessName: string;
  email: string;
  role: MemberRole;
  invitedByName: string;
  state: "VALID" | "EXPIRED" | "USED" | "CANCELLED";
};

export async function getInvitationByToken(token: string): Promise<InvitationView | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const sql = getSqlClient();
  const rows = await sql`
    select i.id, i.business_id, b.name as business_name, i.email, i.role, i.status, i.expires_at, u.name as invited_by_name
    from business_invitation i
    inner join business b on b.id = i.business_id
    inner join "user" u on u.id = i.invited_by
    where i.token_hash = ${hashInvitationToken(token)}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const status = String(row.status);
  const state: InvitationView["state"] = status === "ACCEPTED" ? "USED" : status === "CANCELLED" ? "CANCELLED"
    : new Date(String(row.expires_at)).getTime() <= Date.now() ? "EXPIRED" : "VALID";
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    businessName: String(row.business_name),
    email: String(row.email),
    role: String(row.role) as MemberRole,
    invitedByName: String(row.invited_by_name),
    state,
  };
}

export type AcceptInvitationResult =
  | { ok: true; businessId: string }
  | { ok: false; reason: "INVALID" | "EXPIRED" | "USED" | "CANCELLED" | "WRONG_EMAIL" | "ALREADY_MEMBER" };

export async function acceptInvitationForUser(userId: string, userEmail: string, token: string): Promise<AcceptInvitationResult> {
  const invitation = await getInvitationByToken(token);
  if (!invitation) return { ok: false, reason: "INVALID" };
  if (invitation.state === "EXPIRED") return { ok: false, reason: "EXPIRED" };
  if (invitation.state === "USED") return { ok: false, reason: "USED" };
  if (invitation.state === "CANCELLED") return { ok: false, reason: "CANCELLED" };
  // La invitación es personal: tener el enlace no alcanza.
  if (invitation.email !== userEmail.trim().toLowerCase()) return { ok: false, reason: "WRONG_EMAIL" };
  const sql = getSqlClient();
  const existing = await sql`select 1 from business_member where business_id = ${invitation.businessId} and user_id = ${userId} limit 1`;
  if (existing[0]) return { ok: false, reason: "ALREADY_MEMBER" };
  const hash = hashInvitationToken(token);
  // El rol sale de la invitación guardada, nunca del pedido del navegador.
  const [accepted] = await sql.transaction([
    sql`
      with accepted as (
        update business_invitation
        set status = 'ACCEPTED', accepted_by = ${userId}, accepted_at = now(), updated_at = now()
        where token_hash = ${hash} and status = 'PENDING' and expires_at > now() and email = ${invitation.email}
        returning business_id, role
      )
      insert into business_member (id, business_id, user_id, role, is_current)
      select ${crypto.randomUUID()}, a.business_id, ${userId}, a.role, false
      from accepted a
      where not exists (select 1 from business_member bm where bm.business_id = a.business_id and bm.user_id = ${userId})
      returning business_id
    `,
    sql`update business_member set is_current = false, updated_at = now() where user_id = ${userId} and is_current and business_id <> ${invitation.businessId} and exists (select 1 from business_member where user_id = ${userId} and business_id = ${invitation.businessId})`,
    sql`update business_member set is_current = true, updated_at = now() where user_id = ${userId} and business_id = ${invitation.businessId}`,
  ]);
  if (!accepted[0]) return { ok: false, reason: "USED" };
  await recordAudit({ businessId: invitation.businessId, actorUserId: userId, action: "TEAM_JOIN", entityType: "member", entityId: userId, metadata: { role: invitation.role } });
  return { ok: true, businessId: invitation.businessId };
}
