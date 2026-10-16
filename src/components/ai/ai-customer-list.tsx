import { UsersRound } from "lucide-react";

import type { AiCustomerListPresentation } from "@/lib/ai/presentation";

export function AiCustomerList({ presentation }: { presentation: AiCustomerListPresentation }) {
  return (
    <section className="mt-4 min-w-0 overflow-hidden rounded-xl border border-line bg-surface" aria-label={presentation.title}>
      <div className="border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-ink"><UsersRound className="size-4 text-muted" aria-hidden="true" />{presentation.title}</h3>
        <p className="mt-1 text-sm text-muted">{presentation.summary}</p>
      </div>
      <ul>
        {presentation.items.map((item) => (
          <li key={item.name} className="flex min-w-0 items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <div className="min-w-0"><p className="truncate font-semibold">{item.name}</p><p className="text-sm text-muted">{item.detail}</p></div>
            <p className="shrink-0 text-right"><span className="block text-xs font-semibold text-[#a8530f]">Debe</span><span className="figure text-lg">{item.balance}</span></p>
          </li>
        ))}
      </ul>
      {presentation.note && <p className="border-t border-line bg-surface-2 px-4 py-2 text-xs text-muted">{presentation.note}</p>}
    </section>
  );
}
