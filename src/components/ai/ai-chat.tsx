"use client";

import { CornerDownLeft, Lightbulb, Mic, Plus, UserRound } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

import { DeetaIcon } from "@/components/ui/logo";

type Message = { id: string; role: "USER" | "ASSISTANT"; content: string };

const suggestions = [
  "¿Cómo me fue hoy?", "¿Qué tengo que reponer?", "¿Qué producto vendo más?",
  "¿En qué estoy gastando más?", "¿Cómo vengo este mes?",
];

const errorMessages: Record<string, string> = {
  RATE_LIMIT: "DEETA AI está recibiendo demasiadas consultas. Esperá unos segundos.",
  MONTHLY_LIMIT: "Alcanzaste el límite de consultas de este mes.",
  PROVIDER_ERROR: "No pude responder en este momento. Tus datos siguen seguros. Intentá nuevamente.",
  UNAVAILABLE: "DEETA AI está temporalmente no disponible.",
  FORBIDDEN: "No tenés permiso para usar DEETA AI.",
  INVALID_CONVERSATION: "Esta conversación ya no está disponible. Empezá una nueva.",
};

export function AiChat({ enabled, initialConversation }: { enabled: boolean; initialConversation: { id: string; messages: Message[] } | null }) {
  const [conversationId, setConversationId] = useState(initialConversation?.id ?? null);
  const [messages, setMessages] = useState<Message[]>(initialConversation?.messages ?? []);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  function newConversation() {
    setConversationId(null); setMessages([]); setQuestion(""); setError(null);
  }

  async function ask(value: string) {
    const clean = value.trim();
    if (!enabled || pending || clean.length < 2) return;
    sequence.current += 1;
    const userMessage = { id: `local-user-${sequence.current}`, role: "USER" as const, content: clean };
    setMessages((current) => [...current, userMessage]); setQuestion(""); setError(null); setPending(true);
    try {
      const response = await fetch("/api/deeta-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: clean, conversationId }) });
      const payload = await response.json() as { ok?: boolean; conversationId?: string; answer?: string; error?: string; message?: string };
      if (!response.ok || !payload.answer || !payload.conversationId) throw new Error(payload.error ?? payload.message ?? "PROVIDER_ERROR");
      sequence.current += 1;
      setConversationId(payload.conversationId);
      setMessages((current) => [...current, { id: `local-assistant-${sequence.current}`, role: "ASSISTANT", content: payload.answer! }]);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "PROVIDER_ERROR";
      setError(errorMessages[code] ?? errorMessages.PROVIDER_ERROR);
    } finally { setPending(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(question); }

  return <div className="mx-auto max-w-4xl">
    <header className="flex items-start justify-between gap-3">
      <div><p className="section-label">Asistente del negocio</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl"><DeetaIcon className="size-10" priority /> DEETA AI</h1><p className="mt-3 max-w-2xl leading-7 text-muted">Preguntá con tus palabras. DEETA cruza únicamente la información registrada en tu negocio y explica qué encontró.</p></div>
      <button type="button" onClick={newConversation} className="button-secondary shrink-0 px-3 sm:px-4" disabled={pending} aria-label="Iniciar una nueva conversación"><Plus className="size-5" aria-hidden="true" /><span className="hidden sm:inline">Nueva conversación</span></button>
    </header>
    {!enabled && <div className="notice-error mt-6" role="alert">DEETA AI está temporalmente no disponible porque falta configurar el proveedor. El resto de DEETA sigue funcionando normalmente.</div>}
    <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="max-h-[60dvh] min-h-[360px] overflow-y-auto px-4 py-5 sm:min-h-[470px] sm:px-7 sm:py-7" aria-live="polite" aria-busy={pending}>
        {messages.length === 0 ? <div className="grid min-h-[315px] place-items-center"><div className="w-full max-w-2xl"><div className="flex items-start gap-3"><Lightbulb className="mt-1 size-6 shrink-0 text-mint-600" aria-hidden="true" /><div><h2 className="text-xl font-black">Empezá por una decisión concreta</h2><p className="mt-2 text-sm leading-6 text-muted">Podés consultar ventas, gastos, margen, stock, caja y productos. Estas preguntas son un buen punto de partida.</p></div></div><div className="mt-6 grid gap-2 sm:grid-cols-2">{suggestions.map((item) => <button key={item} type="button" onClick={() => void ask(item)} disabled={!enabled || pending} className="min-h-12 rounded-xl border border-line bg-canvas px-4 py-3 text-left text-sm font-extrabold text-ink transition-colors hover:border-mint-400 hover:bg-mint-50 disabled:opacity-50">{item}</button>)}</div></div></div> : <div className="grid gap-7">{messages.map((message) => <article key={message.id} className={message.role === "USER" ? "ml-auto flex max-w-[88%] items-start gap-3" : "flex items-start gap-3 border-l-4 border-mint-400 pl-4 sm:pl-5"}>{message.role === "ASSISTANT" && <DeetaIcon className="size-9" />}<div className={message.role === "USER" ? "whitespace-pre-wrap rounded-xl bg-ink px-4 py-3 text-sm leading-6 text-white sm:text-base" : "min-w-0 flex-1 whitespace-pre-wrap pt-1 text-sm leading-7 text-ink sm:text-base"}>{message.content}</div>{message.role === "USER" && <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink text-white"><UserRound className="size-5" aria-hidden="true" /></span>}</article>)}{pending && <div className="flex items-center gap-3 border-l-4 border-mint-400 pl-4 text-sm font-bold text-muted"><DeetaIcon className="size-9" /> Revisando ventas, gastos y stock…</div>}</div>}
      </div>
      <form onSubmit={submit} className="border-t border-line bg-canvas p-3 sm:p-4"><label className="sr-only" htmlFor="deeta-ai-question">Pregunta para DEETA AI</label><div className="flex items-end gap-2"><textarea id="deeta-ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(question); } }} disabled={!enabled || pending} maxLength={800} rows={1} placeholder="Ej. ¿Qué debería reponer esta semana?" className="field-input min-h-12 min-w-0 max-h-36 resize-y py-3" /><span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted" title="Voz: próximamente" aria-label="Entrada por voz: próximamente"><Mic className="size-5" aria-hidden="true" /></span><button type="submit" disabled={!enabled || pending || question.trim().length < 2} className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-white transition-colors hover:bg-[#4b30db] disabled:opacity-50" aria-label="Enviar pregunta"><CornerDownLeft className="size-5" aria-hidden="true" /></button></div>{error && <p className="notice-error mt-3" role="alert">{error}</p>}<p className="mt-2 text-xs leading-5 text-muted">Responde según los datos cargados en DEETA. No reemplaza asesoramiento contable.</p></form>
    </section>
  </div>;
}
