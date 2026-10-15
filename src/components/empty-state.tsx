import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export type EmptyStateAction = { label: string; href: string; icon?: LucideIcon; variant?: "primary" | "secondary" };

// Estado vacío que enseña el próximo paso. Solo recibe acciones que la persona
// puede realizar: cada pantalla filtra según el rol autenticado.
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  note,
  className = "mt-6",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  note?: string;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface px-5 py-9 sm:px-8 sm:py-12 ${className}`}>
      <div className="mx-auto max-w-md text-center">
        <Icon className="mx-auto size-8 text-muted" strokeWidth={1.6} aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold">{title}</h2>
        <p className="mt-2 leading-7 text-muted">{description}</p>
        {actions.length > 0 && (
          <div className={`mt-6 grid gap-2 ${actions.length > 1 ? "sm:grid-cols-2" : "sm:mx-auto sm:max-w-64"}`}>
            {actions.map(({ label, href, icon: ActionIcon, variant = "primary" }) => (
              <Link key={href} href={href as Route} className={variant === "primary" ? "button-primary" : "button-secondary"}>
                {ActionIcon && <ActionIcon className="size-5" aria-hidden="true" />} {label}
              </Link>
            ))}
          </div>
        )}
        {note && <p className="mt-4 text-sm leading-6 text-muted">{note}</p>}
      </div>
    </section>
  );
}
