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
      <h1 className="page-title">Creá tu cuenta</h1>
      <p className="page-lead">Solo necesitamos algunos datos para comenzar.</p>
      <div className="panel mt-6"><AuthForm mode="sign-up" /></div>
    </section>
  );
}
