"use client";

import { RotateCcw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-7">
        <p className="text-sm font-semibold text-[#a8530f]">No pudimos cargar esta pantalla</p>
        <h1 className="mt-1 text-2xl font-bold">Algo no salió como esperábamos</h1>
        <p className="mt-2 leading-7 text-muted">Tus datos siguen seguros. Probá de nuevo; si vuelve a pasar, revisá tu conexión.</p>
        <button type="button" onClick={reset} className="button-primary mt-6 w-full"><RotateCcw className="size-5" aria-hidden="true" /> Intentar nuevamente</button>
      </div>
    </main>
  );
}
