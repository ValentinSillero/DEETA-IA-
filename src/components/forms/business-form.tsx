"use client";

import { useActionState } from "react";

import type { FormState } from "@/actions/business";
import { Field, SelectField } from "@/components/forms/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { BUSINESS_CATEGORIES, BUSINESS_TIMEZONES } from "@/lib/constants";

type BusinessValues = {
  name?: string;
  category?: string;
  city?: string;
  province?: string;
  phone?: string | null;
  timezone?: string;
};

export function BusinessForm({
  action,
  values = {},
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values?: BusinessValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" } satisfies FormState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field
        label="Nombre del negocio"
        name="name"
        placeholder="Ej. Almacén Don José"
        defaultValue={values.name}
        autoComplete="organization"
        error={state.errors?.name?.[0]}
        required
      />
      <SelectField label="Zona horaria" name="timezone" defaultValue={values.timezone ?? "America/Argentina/Buenos_Aires"} error={state.errors?.timezone?.[0]} required>
        {BUSINESS_TIMEZONES.map((timezone) => <option key={timezone.value} value={timezone.value}>{timezone.label}</option>)}
      </SelectField>
      <SelectField
        label="Rubro"
        name="category"
        defaultValue={values.category ?? ""}
        error={state.errors?.category?.[0]}
        required
      >
        <option value="" disabled>
          Elegí una opción
        </option>
        {BUSINESS_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Ciudad"
          name="city"
          placeholder="Tu ciudad"
          defaultValue={values.city}
          autoComplete="address-level2"
          error={state.errors?.city?.[0]}
          required
        />
        <Field
          label="Provincia"
          name="province"
          placeholder="Tu provincia"
          defaultValue={values.province}
          autoComplete="address-level1"
          error={state.errors?.province?.[0]}
          required
        />
      </div>
      <Field
        label="Teléfono (opcional)"
        name="phone"
        type="tel"
        inputMode="tel"
        placeholder="Ej. 099 123 456"
        defaultValue={values.phone ?? ""}
        autoComplete="tel"
        error={state.errors?.phone?.[0]}
      />
      {state.message && (
        <div className={state.status === "success" ? "notice-success" : "notice-error"} role="status">
          {state.message}
        </div>
      )}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
