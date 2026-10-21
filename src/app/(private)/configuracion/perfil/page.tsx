import type { Metadata } from "next";

import { ProfileForm } from "@/components/forms/profile-form";
import { SignOutButton } from "@/components/navigation/sign-out-button";
import { XProfileLink } from "@/components/support/x-profile-link";
import { getXProfile } from "@/lib/social";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfileSettingsPage() {
  const session = await requireSession();

  return (
    <div className="max-w-3xl">
      
      <h1 className="page-title">Mi perfil</h1>
      <p className="mt-3 max-w-xl leading-7 text-muted">Estos son los datos de tu cuenta en DEETA.</p>
      <section className="panel mt-7"><ProfileForm name={session.user.name} email={session.user.email} /></section>
      {getXProfile() && (
        <section className="panel mt-6" aria-labelledby="contacto-title">
          <h2 id="contacto-title" className="text-lg font-black">Contacto</h2>
          <p className="mt-1 text-sm leading-6 text-muted">¿Tenés una duda, encontraste un problema o querés sugerir algo? Escribinos por X (Twitter).</p>
          <XProfileLink className="button-secondary mt-4 w-full hover:no-underline sm:w-auto">Contacto</XProfileLink>
        </section>
      )}
      <div className="mt-6 md:hidden"><SignOutButton /></div>
    </div>
  );
}
