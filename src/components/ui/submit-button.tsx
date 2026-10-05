"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button-primary w-full" disabled={pending}>
      {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
      {pending ? "Guardando…" : children}
    </button>
  );
}
