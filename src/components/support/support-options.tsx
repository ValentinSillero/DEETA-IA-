import { ArrowUpRight, CircleHelp, Lightbulb, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  buildWhatsappLink,
  SUPPORT_TOPIC_HINTS,
  SUPPORT_TOPIC_LABELS,
  SUPPORT_TOPICS,
  supportMessage,
  type SupportTopic,
} from "@/lib/support";

const ICONS: Record<SupportTopic, LucideIcon> = { question: CircleHelp, problem: TriangleAlert, suggestion: Lightbulb };

// Tres caminos a WhatsApp, cada uno con su mensaje inicial.
export function SupportOptions({ number, section }: { number: string | null; section: string | null }) {
  if (!number) {
    return <p className="notice-info rounded-xl border px-4 py-3 text-sm leading-6">La ayuda por WhatsApp todavía no está disponible. Volvé a intentarlo más tarde.</p>;
  }
  return (
    <>
      <ul className="list-surface">
        {SUPPORT_TOPICS.map((topic) => {
          const Icon = ICONS[topic];
          return (
            <li key={topic} className="border-b border-line last:border-b-0">
              <a
                href={buildWhatsappLink(number, supportMessage(topic, section))}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 sm:px-5"
              >
                <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{SUPPORT_TOPIC_LABELS[topic]}</span>
                  <span className="block text-sm text-muted">{SUPPORT_TOPIC_HINTS[topic]}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-muted group-hover:text-ink">
                  <span className="hidden min-[400px]:inline">WhatsApp</span>
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                  <span className="sr-only">(se abre WhatsApp)</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {section && <p className="mt-3 text-sm text-muted">El mensaje menciona que estabas en {section}, nada más.</p>}
    </>
  );
}
