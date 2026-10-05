import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="max-w-md text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-mint-600">Página no encontrada</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Por acá no hay nada</h1>
        <p className="mt-4 leading-7 text-muted">Volvé al inicio para seguir usando DEETA.</p>
        <Link href="/" className="button-primary mt-7">Volver al inicio</Link>
      </div>
    </main>
  );
}
