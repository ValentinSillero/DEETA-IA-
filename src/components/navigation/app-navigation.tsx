"use client";

import {
  Bot,
  ChartNoAxesCombined,
  CircleDollarSign,
  Ellipsis,
  House,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserRound,
  Users,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { Permission } from "@/lib/permissions";

// Cada destino declara el permiso que necesita. El servidor vuelve a validar
// en cada página: ocultar un enlace es solo comodidad.
type NavItem = { href: Route; label: string; icon: LucideIcon; permission?: Permission };

const home: NavItem = { href: "/dashboard", label: "Inicio", icon: House };
const sell: NavItem = { href: "/vender", label: "Vender", icon: ShoppingCart, permission: "SALE_CREATE" };
const products: NavItem = { href: "/productos", label: "Productos", icon: Package, permission: "PRODUCT_VIEW" };
const sales: NavItem = { href: "/ventas", label: "Ventas", icon: ReceiptText, permission: "SALE_VIEW" };
const cash: NavItem = { href: "/caja", label: "Caja", icon: CircleDollarSign, permission: "CASH_OPEN" };
const customers: NavItem = { href: "/clientes", label: "Clientes", icon: UsersRound, permission: "CUSTOMER_VIEW" };
const expenses: NavItem = { href: "/gastos", label: "Gastos", icon: WalletCards, permission: "EXPENSE_VIEW" };
const analytics: NavItem = { href: "/analisis", label: "Análisis", icon: ChartNoAxesCombined, permission: "PROFITABILITY_VIEW" };
const ai: NavItem = { href: "/deeta-ai", label: "DEETA AI", icon: Bot, permission: "AI_USE" };
const team: NavItem = { href: "/configuracion/equipo", label: "Equipo", icon: Users, permission: "TEAM_VIEW" };
const settings: NavItem = { href: "/configuracion/negocio", label: "Mi negocio", icon: Settings, permission: "BUSINESS_SETTINGS" };

// Escritorio: módulos agrupados por cómo se usan durante el día.
const groups: Array<{ label: string | null; items: NavItem[] }> = [
  { label: null, items: [home] },
  { label: "Día a día", items: [sales, customers, cash, expenses] },
  { label: "Mercadería", items: [products] },
  { label: "Mi negocio", items: [analytics, ai, team] },
];

// Celular: cuatro destinos directos, Vender al centro y el resto en "Más".
const mobilePrimary: NavItem[] = [home, products, sell, cash, customers];
const mobileMore: Array<NavItem> = [
  sales,
  customers,
  expenses,
  analytics,
  ai,
  team,
  settings,
  { href: "/configuracion/perfil", label: "Mi cuenta", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function visible(items: NavItem[], permissions: readonly Permission[]) {
  return items.filter((item) => !item.permission || permissions.includes(item.permission));
}

// Cada ruta del panel es dinámica y comparte (private)/loading.tsx, así que el
// prefetch por defecto solo baja el esqueleto. Cuando la persona muestra
// intención (hover, toque o foco) ese único link pasa a prefetch completo.
function useIntentPrefetch() {
  const [intent, setIntent] = useState(false);
  const show = () => setIntent(true);
  return { prefetch: intent ? true : null, onPointerEnter: show, onTouchStart: show, onFocus: show } as const;
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const intent = useIntentPrefetch();
  const Icon = item.icon;
  return (
    <Link href={item.href} className="side-link" data-active={active || undefined} aria-current={active ? "page" : undefined} {...intent}>
      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.9} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function SidebarNavigation({ permissions }: { permissions: readonly Permission[] }) {
  const pathname = usePathname();
  const sellIntent = useIntentPrefetch();
  const selling = isActive(pathname, sell.href);
  return (
    <nav aria-label="Navegación principal" className="grid gap-5">
      {permissions.includes("SALE_CREATE") && (
        <Link href={sell.href} className={`button-brand min-h-11 w-full justify-start px-3.5 ${selling ? "ring-2 ring-brand/25 ring-offset-2" : ""}`} aria-current={selling ? "page" : undefined} {...sellIntent}>
          <ShoppingCart className="size-[18px]" aria-hidden="true" /> Nueva venta
        </Link>
      )}
      {groups.map((group) => {
        const items = visible(group.items, permissions);
        if (items.length === 0) return null;
        return (
          <div key={group.label ?? "inicio"} className="grid gap-0.5">
            {group.label && <p className="mb-1 px-2.5 text-xs font-semibold text-subtle">{group.label}</p>}
            {items.map((item) => <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} />)}
          </div>
        );
      })}
    </nav>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const intent = useIntentPrefetch();
  const Icon = item.icon;
  const isSell = item.href === sell.href;
  return (
    <Link href={item.href} className={`nav-link ${isSell ? "nav-link-sell" : ""}`} data-active={active || undefined} aria-current={active ? "page" : undefined} {...intent}>
      <Icon className="size-5" strokeWidth={active || isSell ? 2.25 : 1.9} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

export function MobileNavigation({ permissions }: { permissions: readonly Permission[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Los cuatro primeros destinos permitidos van en la barra; el resto, en "Más".
  const allowedPrimary = visible(mobilePrimary, permissions).filter((item) => item !== sell);
  const bar = [...allowedPrimary.slice(0, 2), ...(permissions.includes("SALE_CREATE") ? [sell] : []), ...allowedPrimary.slice(2, 3)];
  const more = [...allowedPrimary.slice(3), ...visible(mobileMore, permissions)]
    .filter((item, index, list) => !bar.includes(item) && list.findIndex((other) => other.href === item.href) === index);
  const moreActive = more.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      <nav className="app-navigation" aria-label="Navegación principal" style={{ gridTemplateColumns: `repeat(${bar.length + 1}, minmax(0, 1fr))` }}>
        {bar.map((item) => <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />)}
        <button type="button" className="nav-link" data-active={moreActive || undefined} aria-expanded={moreOpen} aria-controls="mobile-more" onClick={() => setMoreOpen(true)}>
          <Ellipsis className="size-5" aria-hidden="true" />
          <span>Más</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end overscroll-none bg-ink/40" onMouseDown={(event) => event.currentTarget === event.target && setMoreOpen(false)}>
          <div id="mobile-more" role="dialog" aria-modal="true" aria-label="Más secciones" className="w-full overscroll-contain rounded-t-2xl border-t border-line bg-surface px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="font-display text-lg font-bold">Más secciones</p>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Cerrar" autoFocus>
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <ul className="grid">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-13 items-center gap-3 rounded-lg px-3 text-base font-semibold ${active ? "bg-surface-2 text-ink" : "text-ink hover:bg-surface-2"}`}>
                      <Icon className={`size-5 ${active ? "text-brand" : "text-muted"}`} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
