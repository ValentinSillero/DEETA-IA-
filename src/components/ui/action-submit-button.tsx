"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ActionSubmitButton({
  children,
  pendingLabel = "Guardando…",
  className = "button-primary w-full",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
