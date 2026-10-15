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
  className = "mt-7",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  note?: string;
  className?: string;
}) {
  return (
    <section className={`deeta-rule rounded-2xl border border-line bg-surface px-5 py-10 text-center sm:px-8 sm:py-14 ${className}`}>
      <span className="icon-box mx-auto size-14"><Icon className="size-7" aria-hidden="true" /></span>
      <h2 className="mx-auto mt-5 max-w-md text-2xl font-black tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-md leading-7 text-muted">{description}</p>
      {actions.length > 0 && (
        <div className={`mx-auto mt-7 grid max-w-md gap-2 ${actions.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {actions.map(({ label, href, icon: ActionIcon, variant = "primary" }) => (
            <Link key={href} href={href as Route} className={variant === "primary" ? "button-primary" : "button-secondary"}>
              {ActionIcon && <ActionIcon className="size-5" aria-hidden="true" />} {label}
            </Link>
          ))}
        </div>
      )}
      {note && <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted">{note}</p>}
    </section>
  );
}
