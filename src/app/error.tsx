"use client";

import { AlertCircle } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="panel deeta-rule max-w-md text-center">
        <AlertCircle className="mx-auto size-11 text-orange-500" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-black">Algo no salió como esperábamos</h1>
        <p className="mt-3 leading-7 text-muted">No pudimos cargar esta pantalla. Tus datos siguen seguros.</p>
        <button type="button" onClick={reset} className="button-primary mt-6 w-full">Intentar nuevamente</button>
      </div>
    </main>
  );
}
