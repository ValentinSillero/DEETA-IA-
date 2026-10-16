import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ConfigurationRequired } from "@/components/configuration-required";
import { AuthForm } from "@/components/forms/auth-form";
import { isServerConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  await connection();
  if (!isServerConfigured()) return <ConfigurationRequired />;
  const next = safeNextPath((await searchParams).siguiente);
  if (await getSession()) redirect((next ?? "/dashboard") as Route);

  return (
    <section>
      <h1 className="page-title">Ingresá a DEETA</h1>
      <p className="page-lead">Tu negocio te está esperando.</p>
      <div className="panel mt-6"><AuthForm mode="sign-in" next={next} /></div>
    </section>
  );
}
