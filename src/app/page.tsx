import { getSessionCookie } from "better-auth/cookies";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ConfigurationRequired } from "@/components/configuration-required";
import { PublicHeader } from "@/components/landing/public-header";
import {
  AiSection,
  Audience,
  BeforeAfter,
  Difference,
  Features,
  FinalCta,
  Hero,
  HowItWorks,
  PublicFooter,
  Situations,
} from "@/components/landing/sections";
import { isServerConfigured } from "@/lib/env";
import { getSession } from "@/lib/session";

const description = "Ventas, stock, caja, gastos y análisis en un solo lugar. DEETA ayuda a los comercios a ordenar el día a día y entender sus números, desde el celular o la computadora.";

export const metadata: Metadata = {
  title: { absolute: "DEETA | Gestión simple para tu negocio" },
  description,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "DEETA",
    title: "DEETA | Gestión simple para tu negocio",
    description,
  },
};

export default async function HomePage() {
  await connection();
  const configured = isServerConfigured();
  // Solo se consulta la sesión si existe la cookie: un visitante nuevo no
  // genera ninguna consulta a la base de datos.
  if (configured && getSessionCookie(await headers()) && await getSession()) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Ir al contenido</a>
      <PublicHeader />
      {!configured && <div className="mx-auto w-full max-w-[1160px] px-4 pt-4 sm:px-6 lg:px-8"><ConfigurationRequired compact /></div>}
      <main id="contenido">
        <Hero />
        <Situations />
        <BeforeAfter />
        <HowItWorks />
        <Features />
        <AiSection />
        <Audience />
        <Difference />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}
