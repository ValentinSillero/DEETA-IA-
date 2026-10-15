import Link from "next/link";
import { redirect } from "next/navigation";

import { MobileNavigation, SidebarNavigation } from "@/components/navigation/app-navigation";
import { SessionCachePrimer } from "@/components/navigation/session-cache-primer";
import { SignOutButton } from "@/components/navigation/sign-out-button";
import { DeetaProductMark } from "@/components/ui/logo";
import { getBusinessForUser } from "@/data/businesses";
import { requireSession } from "@/lib/session";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const context = await getBusinessForUser(session.user.id);
  if (!context) redirect("/onboarding");
  const canUseAi = context.role !== "EMPLOYEE";
  const initial = session.user.name.trim().slice(0, 1).toUpperCase();

  return (
    <div className="min-h-dvh bg-canvas md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <SessionCachePrimer />
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Ir al contenido</a>

      <aside className="hidden border-r border-line bg-surface md:fixed md:inset-y-0 md:flex md:w-[248px] md:flex-col">
        <div className="px-5 pb-4 pt-5"><DeetaProductMark /></div>
        <Link href="/configuracion/negocio" className="mx-3 flex min-w-0 flex-col rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2">
          <span className="text-xs font-semibold text-subtle">Negocio</span>
          <span className="truncate font-display text-base font-bold text-ink">{context.business.name}</span>
        </Link>
        <div className="mx-5 my-4 border-t border-line" />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"><SidebarNavigation canUseAi={canUseAi} /></div>
        <div className="border-t border-line px-3 py-3">
          <Link href="/configuracion/perfil" className="flex min-w-0 items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2" aria-label="Abrir mi cuenta">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ink text-sm font-bold text-white">{initial}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{session.user.name}</span><span className="block text-xs text-muted">Mi cuenta</span></span>
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 md:col-start-2">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm md:hidden">
          <DeetaProductMark compact />
          <p className="min-w-0 flex-1 truncate text-center font-display text-[0.95rem] font-bold">{context.business.name}</p>
          <Link href="/configuracion/perfil" className="grid size-9 shrink-0 place-items-center rounded-md bg-ink text-sm font-bold text-white" aria-label="Abrir mi cuenta">{initial}</Link>
        </header>
        <main id="contenido" className="mx-auto w-full max-w-[1160px] px-4 pb-28 pt-5 sm:px-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">{children}</main>
      </div>
      <div className="md:hidden"><MobileNavigation canUseAi={canUseAi} /></div>
    </div>
  );
}
