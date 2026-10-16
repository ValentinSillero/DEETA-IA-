"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useActionState, useState } from "react";

import {
  cancelInvitationAction,
  changeMemberRoleAction,
  inviteMemberAction,
  regenerateInvitationAction,
  removeMemberAction,
  type TeamActionState,
} from "@/actions/team";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import { ROLE_CAPABILITIES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AssignableRole } from "@/lib/permissions";

const initial: TeamActionState = { status: "idle" };

function CopyLink({ link, expiresAt }: { link: string; expiresAt?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-line bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="size-4" aria-hidden="true" /> Enlace de invitación</p>
      <input readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="field-input min-h-11 font-mono text-xs" aria-label="Enlace de invitación" />
      <button type="button" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }} className="button-secondary min-h-11">
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}{copied ? "Copiado" : "Copiar enlace"}
      </button>
      <p className="text-xs leading-5 text-muted">Es personal y sirve una sola vez{expiresAt ? `, hasta el ${new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(expiresAt))}` : ""}. Solo funciona para el email invitado.</p>
    </div>
  );
}

export function InviteForm({ roles }: { roles: AssignableRole[] }) {
  const [state, action] = useActionState(inviteMemberAction, initial);
  const [role, setRole] = useState<AssignableRole>(roles.includes("SELLER") ? "SELLER" : roles[roles.length - 1]);
  return (
    <form action={action} className="grid gap-4">
      <label className="field-label">Email
        <input name="email" type="email" inputMode="email" autoComplete="off" spellCheck={false} required className="field-input" placeholder="persona@email.com" />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">Rol</legend>
        <div className="mt-2 grid gap-2">
          {roles.map((option) => (
            <label key={option} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${role === option ? "border-ink bg-surface-2" : "border-line-strong hover:bg-surface-2"}`}>
              <input type="radio" name="role" value={option} checked={role === option} onChange={() => setRole(option)} className="mt-1" />
              <span><span className="block font-semibold">{ROLE_LABELS[option]}</span><span className="block text-sm text-muted">{ROLE_DESCRIPTIONS[option]}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <details className="text-sm">
        <summary className="flex min-h-10 cursor-pointer items-center font-semibold text-muted">Qué puede hacer un {ROLE_LABELS[role].toLowerCase()}</summary>
        <ul className="mt-1 grid gap-1 pl-1 text-muted">{ROLE_CAPABILITIES[role].map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />{item}</li>)}</ul>
      </details>
      {state.status === "error" && <p className="notice-error" role="alert">{state.message}</p>}
      {state.status === "success" && <p className="notice-success" role="status">{state.message}</p>}
      {state.link && <CopyLink link={state.link} expiresAt={state.expiresAt} />}
      <ActionSubmitButton className="button-primary w-full" pendingLabel="Creando…">Crear invitación</ActionSubmitButton>
    </form>
  );
}

export function MemberActions({ userId, role, roles, canRemove }: { userId: string; role: AssignableRole; roles: AssignableRole[]; canRemove: boolean }) {
  const [roleState, roleAction] = useActionState(changeMemberRoleAction, initial);
  const [removeState, removeAction] = useActionState(removeMemberAction, initial);
  return (
    <div className="grid gap-2">
      <form action={roleAction} className="flex max-w-sm items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <label className="sr-only" htmlFor={`role-${userId}`}>Rol</label>
        <select id={`role-${userId}`} name="role" defaultValue={role} className="field-input min-h-10 py-1.5 text-sm">
          {roles.map((option) => <option key={option} value={option}>{ROLE_LABELS[option]}</option>)}
        </select>
        <ActionSubmitButton className="button-secondary min-h-10 shrink-0 px-3 text-sm" pendingLabel="…">Cambiar</ActionSubmitButton>
      </form>
      {canRemove && (
        <form action={removeAction} onSubmit={(event) => { if (!window.confirm("¿Quitar a esta persona del negocio? Su historial se conserva.")) event.preventDefault(); }}>
          <input type="hidden" name="userId" value={userId} />
          <ActionSubmitButton className="button-quiet min-h-10 px-2 text-sm text-red-700" pendingLabel="Quitando…">Quitar del negocio</ActionSubmitButton>
        </form>
      )}
      {[roleState, removeState].map((state, index) => state.message && <p key={index} className={state.status === "success" ? "notice-success" : "notice-error"} role="status">{state.message}</p>)}
    </div>
  );
}

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const [regenState, regenAction] = useActionState(regenerateInvitationAction, initial);
  const [cancelState, cancelAction] = useActionState(cancelInvitationAction, initial);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={regenAction}><input type="hidden" name="invitationId" value={invitationId} /><ActionSubmitButton className="button-secondary min-h-10 px-3 text-sm" pendingLabel="Generando…">Nuevo enlace</ActionSubmitButton></form>
        <form action={cancelAction}><input type="hidden" name="invitationId" value={invitationId} /><ActionSubmitButton className="button-quiet min-h-10 px-2 text-sm" pendingLabel="Cancelando…">Cancelar</ActionSubmitButton></form>
      </div>
      {regenState.link && <CopyLink link={regenState.link} expiresAt={regenState.expiresAt} />}
      {[regenState, cancelState].map((state, index) => state.status === "error" && <p key={index} className="notice-error" role="alert">{state.message}</p>)}
    </div>
  );
}
