import { Lock } from "lucide-react";
import Link from "next/link";

// Se muestra cuando alguien entra por URL a una sección que su rol no permite.
// El bloqueo real ocurre en el servidor: esta pantalla solo lo explica.
export function NoAccess({ section }: { section?: string }) {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-line bg-surface px-6 py-10 text-center" role="alert">
      <Lock className="mx-auto size-8 text-muted" strokeWidth={1.6} aria-hidden="true" />
      <h1 className="mt-4 text-xl font-bold">No tenés acceso{section ? ` a ${section}` : ""}</h1>
      <p className="mt-2 leading-7 text-muted">Tu rol en este negocio no incluye esta sección. Si la necesitás, pedíselo a quien administra el negocio.</p>
      <Link href="/dashboard" className="button-secondary mt-6">Volver al inicio</Link>
    </section>
  );
}
