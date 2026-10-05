import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createBusinessAction } from "@/actions/business";
import { BusinessForm } from "@/components/forms/business-form";
import { DeetaBrandLogo } from "@/components/ui/logo";
import { getBusinessForUser } from "@/data/businesses";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Tu negocio" };

export default async function OnboardingPage() {
  const session = await requireSession();
  if (await getBusinessForUser(session.user.id)) redirect("/dashboard");

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6 sm:px-8">
        <DeetaBrandLogo className="w-36 sm:w-40" />
        <span className="rounded-lg bg-mint-100 px-3 py-1.5 text-xs font-extrabold text-mint-600">Último paso</span>
      </header>
      <div className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <div className="mb-8 max-w-xl">
          <p className="section-label">Bienvenido, {session.user.name.split(" ")[0]}</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Contanos sobre tu negocio</h1>
          <p className="mt-4 text-base leading-7 text-muted">Esto nos ayuda a dejar todo listo para vos. Podés cambiarlo más adelante.</p>
        </div>
        <section className="panel"><BusinessForm action={createBusinessAction} submitLabel="Crear mi negocio" /></section>
      </div>
    </main>
  );
}
