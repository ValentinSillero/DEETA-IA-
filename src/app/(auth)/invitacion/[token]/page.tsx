import { CircleAlert, UsersRound } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { AcceptInvitationForm } from "@/components/team/accept-invitation-form";
import { SignOutButton } from "@/components/navigation/sign-out-button";
import { getInvitationByToken } from "@/data/team";
import { getSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { maskEmail } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Invitación", robots: { index: false } };

function Message({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel" role="status">
      <CircleAlert className="size-7 text-[#a8530f]" aria-hidden="true" />
      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      <p className="mt-2 leading-7 text-muted">{text}</p>
      <Link href="/" className="button-secondary mt-6 w-full">Ir al inicio</Link>
    </section>
  );
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const [invitation, session] = await Promise.all([getInvitationByToken(token), getSession()]);
  if (!invitation) return <Message title="Enlace no válido" text="Este enlace de invitación no existe o está incompleto. Pedile a quien te invitó que te lo envíe de nuevo." />;
  if (invitation.state === "EXPIRED") return <Message title="La invitación venció" text="Pedile a quien te invitó que genere un enlace nuevo desde Equipo." />;
  if (invitation.state === "USED") return <Message title="Invitación ya utilizada" text="Este enlace ya se usó. Si ya te uniste, iniciá sesión normalmente." />;
  if (invitation.state === "CANCELLED") return <Message title="Invitación cancelada" text="Quien te invitó canceló esta invitación." />;

  const next = `/invitacion/${token}`;
  const sessionEmail = session?.user.email.toLowerCase() ?? null;
  const emailMatches = sessionEmail === invitation.email;

  return (
    <section>
      <UsersRound className="size-8 text-brand" aria-hidden="true" />
      <h1 className="page-title mt-3">Te invitaron a {invitation.businessName}</h1>
      <p className="page-lead">{invitation.invitedByName} te invitó a sumarte como <strong className="font-semibold text-ink">{ROLE_LABELS[invitation.role]}</strong>.</p>
      <div className="panel mt-6">
        {!session ? (
          <>
            <p className="leading-7">Esta invitación es para <strong className="font-semibold">{maskEmail(invitation.email)}</strong>. Entrá con esa cuenta o creala si todavía no la tenés.</p>
            <div className="mt-5 grid gap-2">
              <Link href={`/iniciar-sesion?siguiente=${encodeURIComponent(next)}` as Route} className="button-primary">Ya tengo cuenta</Link>
              <Link href={`/crear-cuenta?siguiente=${encodeURIComponent(next)}` as Route} className="button-secondary">Crear mi cuenta</Link>
            </div>
          </>
        ) : !emailMatches ? (
          <>
            <p className="notice-warning">Esta invitación es para otro email ({maskEmail(invitation.email)}). Estás usando {session.user.email}.</p>
            <p className="mt-3 text-sm leading-6 text-muted">Cerrá sesión y entrá con la cuenta a la que te invitaron.</p>
            <div className="mt-4"><SignOutButton /></div>
          </>
        ) : (
          <AcceptInvitationForm token={token} businessName={invitation.businessName} />
        )}
      </div>
    </section>
  );
}
