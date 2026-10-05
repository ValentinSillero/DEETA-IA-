import { DeetaIcon } from "@/components/ui/logo";

export default function Loading() {
  return (
    <div className="space-y-6" aria-label="Cargando" role="status">
      <span className="sr-only">Cargando contenido</span>
      <div className="flex items-center gap-3"><DeetaIcon className="size-10" priority /><div className="skeleton h-5 w-28 rounded-md" /></div>
      <div className="skeleton h-44 rounded-2xl" />
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-28 bg-[#eceaf2]" />)}
      </div>
    </div>
  );
}
