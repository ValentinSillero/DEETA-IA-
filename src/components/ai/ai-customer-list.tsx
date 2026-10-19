import { UsersRound } from "lucide-react";

import { AiResult } from "@/components/ai/ai-result";
import type { AiCustomerListPresentation } from "@/lib/ai/presentation";

export function AiCustomerList({ presentation }: { presentation: AiCustomerListPresentation }) {
  return (
    <AiResult title={presentation.title} icon={UsersRound} meta={presentation.note}>
      <p className="text-[0.95rem] leading-6 text-ink">{presentation.summary}</p>
      <ul className="mt-1">
        {presentation.items.map((item) => (
          <li key={item.name} className="flex min-w-0 items-start justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
            <div className="min-w-0"><p className="truncate font-semibold">{item.name}</p><p className="text-sm text-muted">{item.detail}</p></div>
            <p className="shrink-0 text-right"><span className="block text-xs font-semibold text-[#a8530f]">Debe</span><span className="figure text-lg">{item.balance}</span></p>
          </li>
        ))}
      </ul>
    </AiResult>
  );
}
