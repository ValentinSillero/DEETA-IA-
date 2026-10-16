import Link from "next/link";

import { getServerConfigurationIssues } from "@/lib/env";

// En desarrollo explica cómo completar la configuración local. En un deploy
// (producción o vista previa) nunca muestra detalles internos al público: el
// detalle queda solo en el log del servidor, sin valores secretos.
export function ConfigurationRequired({ compact = false }: { compact?: boolean }) {
  if (process.env.NODE_ENV === "production") {
    console.error("[DEETA] Configuración del servidor incompleta:", getServerConfigurationIssues().join(" | "));
    if (compact) return null;
    return (
      <section className="panel" role="status">
        <p className="text-sm font-semibold text-[#a8530f]">Servicio no disponible</p>
        <h1 className="mt-1 text-2xl font-bold">No pudimos conectar con DEETA</h1>
        <p className="mt-2 leading-7 text-muted">Estamos teniendo un problema para iniciar sesión. Probá de nuevo en unos minutos.</p>
        <Link href="/" className="button-secondary mt-6 w-full">Volver al inicio</Link>
      </section>
    );
  }

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-ink"
          : "panel border-orange-200 bg-orange-50"
      }
      role="status"
    >
      <p className={compact ? "font-extrabold" : "text-xl font-black"}>
        Falta conectar la base de datos
      </p>
      <p className={compact ? "mt-1 leading-6 text-muted" : "mt-3 leading-7 text-muted"}>
        El código de DEETA está listo, pero para iniciar sesión y usar Productos, Ventas y Caja tenés que
        crear <code className="font-bold text-ink">.env.local</code> con los datos de Neon y Better Auth.
      </p>
      {!compact && (
        <>
          <div className="mt-5 rounded-2xl bg-ink p-4 font-mono text-xs leading-6 text-white">
            <p>DATABASE_URL=...</p>
            <p>BETTER_AUTH_SECRET=...</p>
            <p>BETTER_AUTH_URL=http://localhost:3000</p>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            Después ejecutá <code className="font-bold text-ink">npm run db:migrate</code> y reiniciá
            la aplicación.
          </p>
          <Link href="/" className="button-secondary mt-6 w-full">
            Volver al inicio
          </Link>
        </>
      )}
    </section>
  );
}
