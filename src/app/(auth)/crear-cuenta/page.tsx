import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ConfigurationRequired } from "@/components/configuration-required";
import { AuthForm } from "@/components/forms/auth-form";
import { isServerConfigured } from "@/lib/env";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage() {
  await connection();
  if (!isServerConfigured()) return <ConfigurationRequired />;
  if (await getSession()) redirect("/dashboard");

  return (
    <section>
      <p className="section-label mb-3">Empezá hoy</p>
      <h1 className="text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">Creá tu cuenta</h1>
      <p className="mt-4 text-base leading-7 text-muted">Solo necesitamos algunos datos para comenzar.</p>
      <div className="panel mt-8"><AuthForm mode="sign-up" /></div>
    </section>
  );
}
