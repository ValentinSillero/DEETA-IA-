import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="max-w-md text-center">
        
        <p className="text-sm font-semibold text-muted">Error 404</p>
        <h1 className="mt-1 text-3xl font-bold">Por acá no hay nada</h1>
        <p className="mt-4 leading-7 text-muted">Volvé al inicio para seguir usando DEETA.</p>
        <Link href="/" className="button-primary mt-7">Volver al inicio</Link>
      </div>
    </main>
  );
}
