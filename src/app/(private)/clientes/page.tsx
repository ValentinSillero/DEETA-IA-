import { ArrowRight, CircleCheck, Plus, SearchX, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ProductSearch } from "@/components/products/product-search";
import { getCustomersPageForUser, type CustomerFilter } from "@/data/customers";
import { relativeDaysLabel } from "@/lib/customers";
import { formatMoney } from "@/lib/inventory";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Clientes" };

const filters: Array<{ value: CustomerFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "debt", label: "Con deuda" },
  { value: "inactive", label: "Desactivados" },
];

function isFilter(value: string | undefined): value is CustomerFilter {
  return value === "all" || value === "debt" || value === "inactive";
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ buscar?: string; estado?: string }> }) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "CUSTOMER_VIEW")) return <NoAccess section="Clientes" />;
  const membership = await getActiveMembership(session.user.id);
  const search = params.buscar?.slice(0, 80) ?? "";
  const filter = isFilter(params.estado) ? params.estado : "all";
  const page = await getCustomersPageForUser(session.user.id, { search, filter });
  if (!page) redirect("/onboarding");
  const { customers, summary } = page;
  const noCustomersYet = summary.activeCustomers === 0 && filter === "all" && !search;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-lead">Quién te debe, cuánto y desde cuándo.</p>
        </div>
        {!noCustomersYet && can(membership, "CUSTOMER_EDIT") && <Link href="/clientes/nuevo" className="button-primary"><Plus className="size-5" aria-hidden="true" /> Nuevo cliente</Link>}
      </div>

      {noCustomersYet ? (
        <EmptyState
          icon={UsersRound}
          title="Todavía no cargaste clientes"
          description="Podés crear clientes para registrar ventas fiadas y llevar su cuenta corriente."
          actions={can(membership, "CUSTOMER_EDIT") ? [{ label: "Agregar cliente", href: "/clientes/nuevo", icon: Plus }] : []}
        />
      ) : (
        <>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <div><dt className="text-sm text-muted">Total pendiente</dt><dd className="figure text-2xl">{formatMoney(summary.pendingCents)}</dd></div>
            <div><dt className="text-sm text-muted">Clientes con deuda</dt><dd className="figure text-2xl">{summary.debtors}</dd></div>
            <div><dt className="text-sm text-muted">Pagos recibidos este mes</dt><dd className="figure text-2xl">{formatMoney(summary.paymentsThisMonthCents)}</dd></div>
          </dl>

          <div className="mt-6 grid gap-3">
            <ProductSearch initialValue={search} label="Buscar clientes" placeholder="Buscar por nombre o teléfono" />
            <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Filtrar clientes">
              {filters.map((item) => (
                <Link key={item.value} href={item.value === "all" ? "/clientes" : `/clientes?estado=${item.value}`} className="chip" aria-current={filter === item.value ? "page" : undefined}>
                  {item.label}
                  {item.value === "debt" && <span className={filter === item.value ? "text-white/75" : "text-subtle"}>{summary.debtors}</span>}
                </Link>
              ))}
            </nav>
          </div>

          {customers.length === 0 ? (
            <section className="mt-5 rounded-2xl border border-line bg-surface px-5 py-10 text-center">
              <SearchX className="mx-auto size-7 text-muted" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-bold">No encontramos clientes</h2>
              <p className="mt-1 text-sm text-muted">{search ? "Probá con otro nombre o teléfono." : filter === "debt" ? "Nadie te debe: todos están al día." : "No hay clientes en este filtro."}</p>
            </section>
          ) : (
            <ul className="list-surface mt-4" aria-label="Lista de clientes">
              {customers.map((customer) => (
                <li key={customer.id} className="border-b border-line last:border-b-0">
                  <Link href={`/clientes/${customer.id}`} className="group flex min-w-0 items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{customer.name}</p>
                      <p className="truncate text-sm text-muted">
                        {customer.phone ? `${customer.phone} · ` : ""}Último movimiento: {relativeDaysLabel(customer.lastMovementAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {customer.balanceCents > 0 ? (
                        <><p className="text-xs font-semibold text-[#a8530f]">Debe</p><p className="figure text-lg leading-tight">{formatMoney(customer.balanceCents)}</p></>
                      ) : (
                        <p className="status text-sm text-success"><CircleCheck className="size-4" aria-hidden="true" /> Al día</p>
                      )}
                    </div>
                    <ArrowRight className="hidden size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink sm:block" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
