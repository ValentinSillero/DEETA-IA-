import type { Metadata } from "next";

import { ProfileForm } from "@/components/forms/profile-form";
import { SignOutButton } from "@/components/navigation/sign-out-button";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfileSettingsPage() {
  const session = await requireSession();

  return (
    <div className="max-w-3xl">
      
      <h1 className="page-title">Mi perfil</h1>
      <p className="mt-3 max-w-xl leading-7 text-muted">Estos son los datos de tu cuenta en DEETA.</p>
      <section className="panel mt-7"><ProfileForm name={session.user.name} email={session.user.email} /></section>
      <div className="mt-6 md:hidden"><SignOutButton /></div>
    </div>
  );
}
