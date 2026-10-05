import { ArrowRight, BarChart3, CheckCircle2, Package, ScanLine, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { ConfigurationRequired } from "@/components/configuration-required";
import { DeetaBrandLogo } from "@/components/ui/logo";
import { isServerConfigured } from "@/lib/env";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  await connection();
  const configured = isServerConfigured();
  const session = configured ? await getSession() : null;

  const features = [
    { icon: ShoppingCart, title: "Ventas sin demora", text: "Registrá una venta en pocos pasos y seguí con tu día." },
    { icon: Package, title: "Stock bajo control", text: "Entendé qué hay, qué falta y qué se está moviendo." },
    { icon: BarChart3, title: "Números explicados", text: "Ventas, gastos y resultado presentados para poder decidir." },
  ];

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <DeetaBrandLogo className="w-36 sm:w-40" />
        <Link href={session ? "/dashboard" : "/iniciar-sesion"} className="button-secondary min-h-11 px-4 py-2 text-sm">
          {session ? "Ir a mi negocio" : "Iniciar sesión"}
        </Link>
      </header>

      {!configured && <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-8 lg:px-10"><ConfigurationRequired compact /></div>}

      <section className="mx-auto grid w-full max-w-[1180px] items-stretch gap-8 px-5 pb-16 pt-8 sm:px-8 sm:pt-14 lg:grid-cols-[1.06fr_.94fr] lg:px-10 lg:pb-24">
        <div className="flex flex-col justify-center py-5 lg:py-14">
          <p className="section-label">Gestión clara para comercios</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.8rem,10vw,5.8rem)] font-black leading-[0.94] tracking-[-0.065em] text-ink">
            Tu negocio en orden.
            <span className="block text-mint-600">Tus decisiones, más claras.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-muted sm:text-xl">Vendé, controlá stock, registrá gastos y entendé qué está pasando sin planillas ni términos complicados.</p>
          <div className="mt-8 flex flex-col gap-3 min-[430px]:flex-row">
            <Link href={session ? "/dashboard" : "/crear-cuenta"} className="button-primary min-w-44">
              {session ? "Entrar a DEETA" : "Empezar ahora"}<ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            {!session && <Link href="/iniciar-sesion" className="button-secondary min-w-44">Ya tengo cuenta</Link>}
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-muted"><CheckCircle2 className="size-5 text-mint-600" aria-hidden="true" /> Hecho para usar desde el celular, desde el primer día.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="deeta-rule border-b border-line p-6 sm:p-8">
            <div className="flex items-center justify-between gap-5"><div><p className="section-label">Hoy en tu negocio</p><p className="mt-2 text-2xl font-black text-ink">Todo lo importante, junto</p></div><span className="icon-box size-12"><ScanLine className="size-6" aria-hidden="true" /></span></div>
          </div>
          <div className="divide-y divide-line">
            {features.map(({ icon: Icon, title, text }, index) => <div key={title} className="flex gap-4 p-6 sm:px-8"><span className="font-mono text-xs font-bold text-muted">0{index + 1}</span><Icon className={`size-5 shrink-0 ${index === 1 ? "text-accent" : "text-brand"}`} aria-hidden="true" /><div><h2 className="font-black text-ink">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{text}</p></div></div>)}
          </div>
        </div>
      </section>
    </main>
  );
}
