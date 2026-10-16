import { Clock3, UserPlus } from "lucide-react";
import type { Metadata } from "next";

import { NoAccess } from "@/components/no-access";
import { InvitationActions, InviteForm, MemberActions } from "@/components/team/team-forms";
import { getTeamForUser } from "@/data/team";
import { ASSIGNABLE_ROLES, effectiveRole, hasPermission, ROLE_LABELS } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage() {
  const session = await requireSession();
  const team = await getTeamForUser(session.user.id);
  if (!team) return <NoAccess section="Equipo" />;
  const { membership, members, invitations } = team;
  const canInvite = hasPermission(membership.role, "TEAM_INVITE");
  const canManage = hasPermission(membership.role, "TEAM_MANAGE");
  const canManageOwners = hasPermission(membership.role, "OWNER_MANAGE");
  // Un administrador no puede asignar ni quitar el rol de dueño.
  const assignable = ASSIGNABLE_ROLES.filter((role) => role !== "OWNER" || canManageOwners);
  const dateLabel = (date: Date) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: membership.timezone }).format(date);

  return (
    <div>
      <h1 className="page-title">Equipo</h1>
      <p className="page-lead">Invitá personas a tu negocio y elegí qué pueden hacer.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="personas-titulo">
          <h2 id="personas-titulo" className="section-title mb-3">Personas</h2>
          <ul className="list-surface">
            {members.map((member) => {
              const ownerProtected = member.role === "OWNER" && !canManageOwners;
              const editable = canManage && !member.isSelf && !ownerProtected;
              return (
                <li key={member.userId} className="grid gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5 2xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:items-start">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{member.name}{member.isSelf && <span className="font-normal text-muted"> · Vos</span>}</p>
                    <p className="truncate text-sm text-muted">{member.email}</p>
                    <p className="mt-0.5 text-sm"><span className="font-semibold">{ROLE_LABELS[member.role]}</span><span className="text-muted"> · desde el {dateLabel(member.joinedAt)}</span></p>
                  </div>
                  {editable && <MemberActions userId={member.userId} role={effectiveRole(member.role)} roles={assignable} canRemove={canManage} />}
                </li>
              );
            })}
          </ul>

          {invitations.length > 0 && (
            <>
              <h2 className="section-title mb-3 mt-8">Invitaciones</h2>
              <ul className="list-surface">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="grid gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5 2xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:items-start">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{invitation.email}</p>
                      <p className="text-sm"><span className="font-semibold">{ROLE_LABELS[invitation.role]}</span><span className="text-muted"> · invitado por {invitation.invitedByName}</span></p>
                      <p className={`status mt-1 ${invitation.state === "EXPIRED" ? "text-[#a8530f]" : "text-muted"}`}><Clock3 className="size-3.5" aria-hidden="true" />{invitation.state === "EXPIRED" ? "Invitación vencida" : `Invitación pendiente · vence el ${dateLabel(invitation.expiresAt)}`}</p>
                    </div>
                    {canInvite && (invitation.role !== "OWNER" || canManageOwners) && <InvitationActions invitationId={invitation.id} />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {canInvite && (
          <section className="rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-6" aria-labelledby="invitar-titulo">
            <h2 id="invitar-titulo" className="section-title flex items-center gap-2"><UserPlus className="size-5 text-brand" aria-hidden="true" /> Invitar persona</h2>
            <p className="mb-4 mt-1 text-sm leading-6 text-muted">Cada persona entra con su propia cuenta. Te damos un enlace para enviarle por WhatsApp o email.</p>
            <InviteForm roles={assignable} />
          </section>
        )}
      </div>
    </div>
  );
}
