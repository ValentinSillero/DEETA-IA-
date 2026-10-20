"use client";

import { ArrowRight, ArrowUp, CircleCheck, Inbox, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AiStructuredPresentation } from "@/components/ai/ai-structured-presentation";
import { DeetaIcon } from "@/components/ui/logo";
import { aiEmptyAnswer, type AiEmptyAnswerAction } from "@/lib/ai/empty-answers";
import type { AiPresentation } from "@/lib/ai/presentation";
import { visibleAiResponseText } from "@/lib/ai/presentation-display";
import { keepFocusOnPress } from "@/lib/keep-focus";

type Message = { id: string; role: "USER" | "ASSISTANT"; content: string; presentation?: AiPresentation };
export type AiActionLinks = Partial<Record<AiEmptyAnswerAction, { href: Route; label: string }>>;

const suggestions = [
  "¿Cómo me fue este mes?",
  "¿Qué debería reponer?",
  "¿Qué vendí más?",
  "¿Qué gastos aumentaron?",
];

const errorMessages: Record<string, string> = {
  RATE_LIMIT: "DEETA AI está procesando muchas consultas en este momento. Probá nuevamente en unos instantes.",
  MONTHLY_LIMIT: "Alcanzaste el límite de consultas de este mes.",
  PROVIDER_ERROR: "No pude responder en este momento. Tus datos siguen seguros. Intentá nuevamente.",
  UNAVAILABLE: "DEETA AI está temporalmente no disponible.",
  FORBIDDEN: "No tenés permiso para usar DEETA AI.",
  INVALID_CONVERSATION: "Esta conversación ya no está disponible. Empezá una nueva.",
};

function rateLimitMessage(kind?: string, retryAfterSeconds?: number) {
  const retry = retryAfterSeconds && retryAfterSeconds > 0
    ? ` Podés volver a intentar en aproximadamente ${Math.ceil(retryAfterSeconds)} segundos.`
    : " Probá nuevamente en unos instantes.";
  if (kind === "REQUESTS_PER_DAY" || kind === "TOKENS_PER_DAY") {
    return "DEETA AI alcanzó el límite gratuito disponible por hoy. Podés volver a intentar cuando Groq renueve el cupo.";
  }
  return `DEETA AI está procesando muchas consultas en este momento.${retry}`;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

// Pregunta: bloque chico y discreto, alineado a la derecha.
function Question({ content }: { content: string }) {
  return <div className="flex justify-end">
    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-surface-2 px-3.5 py-2 text-[0.95rem] font-medium leading-6 text-ink sm:max-w-[70%]">
      <span className="sr-only">Tu pregunta: </span>{content}
    </p>
  </div>;
}

function EmptyAnswer({ content, actions }: { content: string; actions: AiActionLinks }) {
  const empty = aiEmptyAnswer(content);
  if (!empty) return null;
  const Icon = empty.tone === "ok" ? CircleCheck : Inbox;
  const action = empty.action ? actions[empty.action] : undefined;
  return <div className="min-w-0">
    <p className="flex items-center gap-2 font-semibold text-ink"><Icon className={`size-[18px] shrink-0 ${empty.tone === "ok" ? "text-success" : "text-muted"}`} aria-hidden="true" />{empty.title}</p>
    <p className="mt-1 text-[0.95rem] leading-6 text-muted">{empty.text}</p>
    {action && <Link href={action.href} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 hover:underline">{action.label}<ArrowRight className="size-4" aria-hidden="true" /></Link>}
  </div>;
}

// Respuesta: bloque principal, con la marca D chica en lugar de repetir "DEETA".
function Answer({ message, actions }: { message: Message; actions: AiActionLinks }) {
  const visibleText = visibleAiResponseText(message.content, message.presentation);
  const empty = !message.presentation && aiEmptyAnswer(message.content);
  return <div className="flex min-w-0 gap-2.5">
    <DeetaIcon className="mt-0.5 size-6 shrink-0" />
    <div className="min-w-0 flex-1">
      <span className="sr-only">DEETA respondió: </span>
      {empty ? <EmptyAnswer content={message.content} actions={actions} />
        : visibleText ? <div className="whitespace-pre-wrap break-words text-base leading-7 text-ink">{visibleText}</div> : null}
      {message.presentation ? <AiStructuredPresentation presentation={message.presentation} /> : null}
      <NextStep presentation={message.presentation} actions={actions} />
    </div>
  </div>;
}

// Qué hacer después de una respuesta de stock: ir a los productos que lo necesitan.
function NextStep({ presentation, actions }: { presentation?: AiPresentation; actions: AiActionLinks }) {
  if (!actions.PRODUCTS || (presentation?.type !== "product-list" && presentation?.type !== "product-highlight")) return null;
  const restock = presentation.variant === "stock" || presentation.variant === "reorder";
  if (!restock && presentation.variant !== "slow-moving" && presentation.variant !== "excess-stock") return null;
  return <Link
    href={restock ? { pathname: actions.PRODUCTS.href, query: { estado: "low" } } : actions.PRODUCTS.href}
    className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 hover:underline"
  >
    {restock ? "Ver productos con poco stock" : actions.PRODUCTS.label}<ArrowRight className="size-4" aria-hidden="true" />
  </Link>;
}

// Agrupa cada pregunta con su respuesta para separar intercambios con espacio, no con líneas.
function exchanges(messages: Message[]) {
  const groups: Message[][] = [];
  for (const message of messages) {
    if (message.role === "USER" || groups.length === 0) groups.push([message]);
    else groups[groups.length - 1].push(message);
  }
  return groups;
}

export function AiChat({ enabled, initialConversation, notice, actions }: { enabled: boolean; initialConversation: { id: string; messages: Message[] } | null; notice?: React.ReactNode; actions: AiActionLinks }) {
  const [conversationId, setConversationId] = useState(initialConversation?.id ?? null);
  const [messages, setMessages] = useState<Message[]>(initialConversation?.messages ?? []);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const lastAnswer = useRef<HTMLElement>(null);
  const lastExchange = useRef<HTMLLIElement>(null);
  const pendingMark = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Al abrir, la conversación arranca en el último intercambio. Se espera un
  // cuadro para que la navegación termine de restaurar el scroll.
  useEffect(() => {
    if (!initialConversation?.messages.length) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => lastExchange.current?.scrollIntoView({ block: "start" })));
    return () => cancelAnimationFrame(frame);
  }, [initialConversation]);

  function newConversation() {
    setConversationId(null); setMessages([]); setQuestion(""); setError(null);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function resizeInput() {
    const element = input.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
  }

  async function ask(value: string) {
    const clean = value.trim();
    if (!enabled || pending || clean.length < 2) return;
    sequence.current += 1;
    const userMessage = { id: `local-user-${sequence.current}`, role: "USER" as const, content: clean };
    setMessages((current) => [...current, userMessage]); setQuestion(""); setError(null); setPending(true);
    requestAnimationFrame(() => { resizeInput(); pendingMark.current?.scrollIntoView({ block: "end", behavior: scrollBehavior() }); });
    try {
      const response = await fetch("/api/deeta-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: clean, conversationId }) });
      const payload = await response.json() as { ok?: boolean; conversationId?: string; answer?: string; presentation?: AiPresentation; error?: string; message?: string; retryAfterSeconds?: number; rateLimitKind?: string };
      if (!response.ok) {
        if (payload.error === "RATE_LIMIT") {
          setError(rateLimitMessage(payload.rateLimitKind, payload.retryAfterSeconds));
          return;
        }
        throw new Error(payload.error ?? payload.message ?? "PROVIDER_ERROR");
      }
      if (!payload.answer || !payload.conversationId) throw new Error("PROVIDER_ERROR");
      sequence.current += 1;
      setConversationId(payload.conversationId);
      setMessages((current) => [...current, { id: `local-assistant-${sequence.current}`, role: "ASSISTANT", content: payload.answer!, presentation: payload.presentation }]);
      // La respuesta se muestra desde su comienzo, aunque sea larga.
      requestAnimationFrame(() => lastAnswer.current?.scrollIntoView({ block: "start", behavior: scrollBehavior() }));
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "PROVIDER_ERROR";
      setError(errorMessages[code] ?? errorMessages.PROVIDER_ERROR);
    } finally { setPending(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(question); }

  const groups = exchanges(messages);
  const canSend = enabled && !pending && question.trim().length >= 2;

  return <div className="ai-chat mx-auto flex w-full max-w-3xl flex-col">
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">DEETA AI</h1>
        <p className="page-lead hidden sm:block">Preguntá con tus palabras. Respondo con los datos de tu negocio.</p>
      </div>
      {messages.length > 0 && <button type="button" onClick={newConversation} className="button-secondary min-h-10 shrink-0 px-3 text-sm" disabled={pending}><Plus className="size-4" aria-hidden="true" />Nueva<span className="-ml-1 hidden sm:inline">conversación</span></button>}
    </header>
    {!enabled && <div className="notice-error mt-4" role="alert">DEETA AI está temporalmente no disponible porque falta configurar el proveedor. El resto de DEETA sigue funcionando normalmente.</div>}

    <div className="flex-1 pb-4 pt-5" aria-live="polite" aria-busy={pending}>
      {messages.length === 0 ? <div className="grid gap-5">
        {notice}
        <div>
          <div className="flex items-center gap-2.5"><DeetaIcon className="size-7 shrink-0" /><h2 className="text-lg font-bold">¿Qué querés saber de tu negocio?</h2></div>
          <p className="mt-2 text-[0.95rem] leading-6 text-muted">Ventas, gastos, margen, stock, caja y productos. Respondo solo con lo que registraste.</p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Preguntas sugeridas">
            {suggestions.map((item) => <li key={item}><button type="button" onClick={() => void ask(item)} disabled={!enabled || pending} className="chip min-h-10 text-ink disabled:opacity-50">{item}</button></li>)}
          </ul>
          <p className="mt-4 text-xs leading-5 text-subtle">No reemplaza el asesoramiento de tu contador.</p>
        </div>
      </div> : <ol className="grid min-w-0 gap-8">
        {groups.map((group, groupIndex) => <li key={group[0].id} ref={groupIndex === groups.length - 1 ? lastExchange : undefined} className="grid min-w-0 scroll-mt-20 gap-3 md:scroll-mt-6">
          {group.map((message, index) => message.role === "USER"
            ? <Question key={message.id} content={message.content} />
            : <section key={message.id} ref={groupIndex === groups.length - 1 && index === group.length - 1 ? lastAnswer : undefined} className="scroll-mt-20 md:scroll-mt-6"><Answer message={message} actions={actions} /></section>)}
        </li>)}
        {pending && <li><div ref={pendingMark} className="flex scroll-mb-28 items-center gap-2.5 text-sm font-medium text-muted" role="status"><DeetaIcon className="size-6 shrink-0 motion-safe:animate-pulse" /> Revisando los datos del negocio…</div></li>}
      </ol>}
    </div>

    <form onSubmit={submit} className="ai-composer sticky z-20 -mx-4 border-t border-line bg-canvas/95 px-4 pb-3 pt-3 backdrop-blur-sm sm:-mx-6 sm:px-6 md:-mx-0 md:border-t-0 md:bg-transparent md:px-0 md:pb-6 md:backdrop-blur-none">
      {error ? <p className="notice-error mb-2" role="alert">{error}</p> : null}
      <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-1.5 pl-3.5 transition-[border-color,box-shadow] focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(91,61,245,0.16)]">
        <label className="sr-only" htmlFor="deeta-ai-question">Pregunta para DEETA AI</label>
        <textarea
          id="deeta-ai-question"
          ref={input}
          value={question}
          onChange={(event) => { setQuestion(event.target.value); resizeInput(); }}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(question); } }}
          disabled={!enabled || pending}
          maxLength={800}
          rows={1}
          enterKeyHint="send"
          autoComplete="off"
          placeholder="Escribí tu pregunta…"
          className="max-h-36 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-base leading-6 text-ink placeholder:text-subtle focus:outline-none focus-visible:outline-none"
        />
        <button type="submit" onMouseDown={keepFocusOnPress} disabled={!canSend} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-hover disabled:bg-line-strong" aria-label="Enviar pregunta"><ArrowUp className="size-5" aria-hidden="true" /></button>
      </div>
    </form>
  </div>;
}
