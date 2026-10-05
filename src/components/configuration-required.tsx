import Link from "next/link";

export function ConfigurationRequired({ compact = false }: { compact?: boolean }) {
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
