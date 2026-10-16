"use client";

import { useActionState } from "react";

import { acceptInvitationAction, type AcceptState } from "@/actions/team";
import { ActionSubmitButton } from "@/components/ui/action-submit-button";

const initial: AcceptState = { status: "idle" };

export function AcceptInvitationForm({ token, businessName }: { token: string; businessName: string }) {
  const [state, action] = useActionState(acceptInvitationAction, initial);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="leading-7">Vas a entrar a <strong className="font-semibold">{businessName}</strong> con tu cuenta actual. Podés pertenecer a varios negocios y cambiar entre ellos.</p>
      {state.message && <p className="notice-error" role="alert">{state.message}</p>}
      <ActionSubmitButton className="button-primary w-full" pendingLabel="Uniéndote…">Unirme a {businessName}</ActionSubmitButton>
    </form>
  );
}
