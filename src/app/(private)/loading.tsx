// Esqueleto con la misma estructura que las pantallas: título, filtros y lista.
export default function Loading() {
  return (
    <div aria-label="Cargando" role="status">
      <span className="sr-only">Cargando contenido…</span>
      <div className="skeleton h-8 w-44" />
      <div className="skeleton mt-2.5 h-4 w-72 max-w-full" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-10 w-24" />)}
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0">
            <div className="min-w-0 flex-1"><div className="skeleton h-4 w-1/2" /><div className="skeleton mt-2 h-3 w-1/3" /></div>
            <div className="skeleton h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
