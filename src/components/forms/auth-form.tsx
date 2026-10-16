"use client";

import { LoaderCircle } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Field } from "@/components/forms/field";
import { authClient } from "@/lib/auth-client";

function friendlyAuthError(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("invalid email or password") || normalized.includes("invalid password")) {
    return "El email o la contraseña no son correctos.";
  }
  if (normalized.includes("already exists") || normalized.includes("already in use")) {
    return "Ya existe una cuenta con ese email.";
  }
  if (normalized.includes("password")) return "La contraseña debe tener al menos 8 caracteres.";
  return "No pudimos completar la operación. Intentá nuevamente.";
}

export function AuthForm({ mode, next = null }: { mode: "sign-in" | "sign-up"; next?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    const result = isSignUp
      ? await authClient.signUp.email({
          name: String(formData.get("name") ?? "").trim(),
          email,
          password,
        })
      : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(friendlyAuthError(result.error.message));
      setLoading(false);
      return;
    }

    // Si venía de una invitación vuelve a aceptarla; si no, al flujo normal.
    router.push((next ?? (isSignUp ? "/onboarding" : "/dashboard")) as Route);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {isSignUp && (
        <Field label="Nombre" name="name" autoComplete="name" placeholder="Tu nombre" required />
      )}
      <Field
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="nombre@ejemplo.com"
        required
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        placeholder={isSignUp ? "Mínimo 8 caracteres" : "Tu contraseña"}
        minLength={8}
        required
      />
      {error && <div className="notice-error" role="alert">{error}</div>}
      <button type="submit" className="button-primary w-full" disabled={loading}>
        {loading && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
        {loading ? "Un momento…" : isSignUp ? "Crear mi cuenta" : "Ingresar"}
      </button>
      <p className="text-center text-sm text-muted">
        {isSignUp ? "¿Ya tenés una cuenta?" : "¿Todavía no tenés cuenta?"}{" "}
        <Link
          href={`${isSignUp ? "/iniciar-sesion" : "/crear-cuenta"}${next ? `?siguiente=${encodeURIComponent(next)}` : ""}` as Route}
          className="font-bold text-ink underline decoration-mint-400 decoration-2 underline-offset-4"
        >
          {isSignUp ? "Iniciar sesión" : "Crear cuenta"}
        </Link>
      </p>
    </form>
  );
}
