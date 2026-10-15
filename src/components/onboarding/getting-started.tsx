import { ArrowRight, Bot, CheckCircle2, ChevronDown, CircleDollarSign, Lock, Minus, Package, ReceiptText, WalletCards, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { setOnboardingPreferenceAction } from "@/actions/onboarding";
import type { OnboardingExtra, OnboardingPlan, OnboardingStep, OnboardingStepId } from "@/lib/onboarding";

const stepIcons: Record<OnboardingStepId, LucideIcon> = { products: Package, cash: CircleDollarSign, sale: ReceiptText };
const extraIcons: Record<OnboardingExtra["id"], LucideIcon> = { expenses: WalletCards, ai: Bot };

function PreferenceButton({ preference, label, children, className }: { preference: "minimized" | "dismissed" | ""; label: string; children: React.ReactNode; className: string }) {
  return (
    <form action={setOnboardingPreferenceAction}>
      <input type="hidden" name="preference" value={preference} />
      <button type="submit" className={className} aria-label={label}>{children}</button>
    </form>
  );
}

function Progress({ completed, total }: { completed: number; total: number }) {
  return (
    <div>
      <p className="text-sm font-extrabold text-ink">{completed} de {total} pasos completados</p>
      <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} aria-label="Progreso de primeros pasos">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={`h-1.5 rounded-full ${index < completed ? "bg-brand" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

function StepItem({ step, index }: { step: OnboardingStep; index: number }) {
  const Icon = stepIcons[step.id];
  const done = step.status === "done";
  const next = step.status === "next";
  const showActions = !done && step.actions.length > 0;
  // Celular: tarjeta apilada. Tablet/escritorio angosto: fila con acciones a la
  // derecha. Escritorio amplio: tres columnas.
  return (
    <li className={`grid min-w-0 gap-4 rounded-xl border p-4 sm:p-5 xl:grid-rows-[1fr_auto] ${showActions ? "sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center xl:grid-cols-1 xl:items-stretch" : ""} ${next ? "border-mint-300 bg-mint-50" : "border-line bg-surface"}`}>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${done ? "bg-accent-soft text-success" : next ? "bg-brand text-white" : "bg-[#f3f2f8] text-muted"}`}>
            {done ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
              Paso {index + 1}
              {next && <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-white">Recomendado</span>}
              {done && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-success">Listo</span>}
            </p>
            {done ? (
              <p className="mt-1 font-black text-success">{step.doneLabel}<span className="sr-only"> (completado)</span></p>
            ) : (
              <h3 className="mt-1 font-black leading-snug">{step.title}</h3>
            )}
          </div>
        </div>
        {!done && <p className="mt-3 text-sm leading-6 text-muted">{step.description}</p>}
        {!done && step.id === "sale" && step.status === "blocked" && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted"><Lock className="size-3.5" aria-hidden="true" /> Necesita productos con stock</p>
        )}
      </div>
      {showActions && (
        <div className="grid content-end gap-2">
          {step.actions.map((action) => (
            <Link key={action.href} href={action.href as Route} className={`${action.variant === "primary" ? "button-primary" : "button-secondary"} w-full`}>
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

function Extras({ extras }: { extras: OnboardingExtra[] }) {
  if (extras.length === 0) return null;
  return (
    <div className="border-t border-line px-5 py-4 sm:px-6">
      <p className="text-sm font-extrabold text-muted">Cuando quieras, también podés</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {extras.map((extra) => {
          const Icon = extraIcons[extra.id];
          return (
            <li key={extra.id}>
              <Link href={extra.action.href as Route} className="group flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-mint-300 hover:bg-mint-50">
                <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className="block text-sm font-black">{extra.title}</span><span className="block text-xs leading-5 text-muted">{extra.description}</span></span>
                <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GettingStarted({ plan }: { plan: OnboardingPlan }) {
  if (plan.mode === "hidden") return null;

  if (plan.mode === "completed") {
    return (
      <section className="overflow-hidden rounded-2xl border border-line bg-surface" aria-labelledby="onboarding-done">
        <div className="flex items-start gap-3 px-5 py-4 sm:items-center sm:px-6">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success sm:mt-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="onboarding-done" className="font-black">Todo listo</h2>
            <p className="text-sm leading-6 text-muted">Tu negocio ya está listo para trabajar con DEETA.</p>
          </div>
          <PreferenceButton preference="dismissed" label="Cerrar aviso de primeros pasos" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-ink">
            <X className="size-5" aria-hidden="true" />
          </PreferenceButton>
        </div>
        <Extras extras={plan.extras} />
      </section>
    );
  }

  if (plan.mode === "minimized") {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 sm:px-5" aria-label="Primeros pasos">
        <span className="icon-box"><Package className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-black">Primeros pasos</p>
          <p className="text-sm text-muted">{plan.completed} de {plan.total} completados</p>
        </div>
        <PreferenceButton preference="" label="Ver primeros pasos" className="button-secondary min-h-11 shrink-0 px-3">
          <span className="hidden min-[360px]:inline">Ver pasos</span><ChevronDown className="size-5" aria-hidden="true" />
        </PreferenceButton>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface" aria-labelledby="onboarding-title">
      <div className="deeta-rule px-5 pb-5 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label">Primeros pasos</p>
            <h2 id="onboarding-title" className="mt-1 text-2xl font-black tracking-[-0.03em]">Prepará tu negocio</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Te recomendamos empezar por acá. Podés usar DEETA libremente mientras tanto.</p>
          </div>
          <PreferenceButton preference="minimized" label="Minimizar primeros pasos" className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-canvas hover:text-ink">
            <Minus className="size-5" aria-hidden="true" />
          </PreferenceButton>
        </div>
        <div className="mt-4 max-w-sm"><Progress completed={plan.completed} total={plan.total} /></div>
        <ol className="mt-5 grid gap-3 xl:grid-cols-3">
          {plan.steps.map((step, index) => <StepItem key={step.id} step={step} index={index} />)}
        </ol>
      </div>
      {plan.completed > 0 && <Extras extras={plan.extras} />}
    </section>
  );
}
