import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { updateBusinessAction } from "@/actions/business";
import { BusinessForm } from "@/components/forms/business-form";
import { getBusinessForUser } from "@/data/businesses";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mi negocio" };

export default async function BusinessSettingsPage() {
  const session = await requireSession();
  const context = await getBusinessForUser(session.user.id);
  if (!context) redirect("/onboarding");

  return (
    <div className="max-w-3xl">
      
      <h1 className="page-title">Mi negocio</h1>
      <p className="mt-3 max-w-xl leading-7 text-muted">Mantené actualizada la información básica de tu comercio.</p>
      <section className="panel mt-7">
        <BusinessForm action={updateBusinessAction} values={context.business} submitLabel="Guardar cambios" />
      </section>
    </div>
  );
}
