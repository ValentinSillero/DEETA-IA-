"use client";

import { useActionState } from "react";

import type { FormState } from "@/actions/business";
import { updateProfileAction } from "@/actions/profile";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(
    updateProfileAction,
    { status: "idle" } satisfies FormState,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field
        label="Nombre"
        name="name"
        defaultValue={name}
        autoComplete="name"
        error={state.errors?.name?.[0]}
        required
      />
      <Field label="Email" name="email" value={email} disabled readOnly />
      <p className="-mt-2 text-xs leading-5 text-muted">El email de acceso no se puede cambiar por ahora.</p>
      {state.message && (
        <div className={state.status === "success" ? "notice-success" : "notice-error"} role="status">
          {state.message}
        </div>
      )}
      <SubmitButton>Guardar cambios</SubmitButton>
    </form>
  );
}
