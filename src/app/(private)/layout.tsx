import { Building2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AppNavigation } from "@/components/navigation/app-navigation";
import { SignOutButton } from "@/components/navigation/sign-out-button";
import { DeetaProductMark } from "@/components/ui/logo";
import { getBusinessForUser } from "@/data/businesses";
import { requireSession } from "@/lib/session";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const session = await requireSession();
  const context = await getBusinessForUser(session.user.id);
  if (!context) redirect("/onboarding");

  return (
    <div className="min-h-dvh bg-canvas md:grid md:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface px-5 py-6 md:fixed md:inset-y-0 md:flex md:w-[264px] md:flex-col">
        <DeetaProductMark />
        <Link href="/configuracion/negocio" className="mt-9 flex items-center gap-3 rounded-xl border border-line bg-canvas p-3 transition-colors hover:border-brand hover:bg-brand-soft">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Building2 className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{context.business.name}</p>
            <p className="text-xs font-semibold text-muted">Espacio de trabajo</p>
          </div>
        </Link>
        <div className="mt-7"><AppNavigation canUseAi={context.role !== "EMPLOYEE"} /></div>
        <div className="mt-auto"><SignOutButton /></div>
      </aside>

      <div className="min-w-0 md:col-start-2">
        <header className="flex h-18 items-center justify-between border-b border-line bg-surface px-4 sm:px-7 md:px-9 lg:px-12">
          <div className="md:hidden"><DeetaProductMark compact /></div>
          <Link href="/configuracion/perfil" className="ml-auto flex min-w-0 items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-brand-soft" aria-label="Abrir mi cuenta">
            <div className="hidden min-w-0 max-w-28 text-right min-[360px]:block sm:max-w-44">
              <p className="truncate text-sm font-extrabold">{session.user.name}</p>
              <p className="truncate text-xs text-muted">{context.business.name}</p>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-black text-brand">
              {session.user.name.slice(0, 1).toUpperCase()}
            </span>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 sm:px-7 md:px-9 md:pb-12 md:pt-9 lg:px-12">{children}</main>
      </div>
      <div className="md:hidden"><AppNavigation canUseAi={context.role !== "EMPLOYEE"} /></div>
    </div>
  );
}
