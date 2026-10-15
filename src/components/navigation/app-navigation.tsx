"use client";

import { Bot, ChartNoAxesCombined, CircleDollarSign, House, Package, ReceiptText, ShoppingCart, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { DeetaIcon } from "@/components/ui/logo";

const links = [
  { href: "/dashboard", label: "Inicio", mobileLabel: "Inicio", icon: House },
  { href: "/vender", label: "Vender", mobileLabel: "Vender", icon: ShoppingCart },
  { href: "/deeta-ai", label: "DEETA AI", mobileLabel: "AI", icon: Bot, aiOnly: true },
  { href: "/gastos", label: "Gastos", mobileLabel: "Gastos", icon: WalletCards },
  { href: "/ventas", label: "Ventas", mobileLabel: "Ventas", icon: ReceiptText, mobileHidden: true },
  { href: "/productos", label: "Productos", mobileLabel: "Stock", icon: Package },
  { href: "/analisis", label: "Análisis", mobileLabel: "Análisis", icon: ChartNoAxesCombined, mobileHidden: true },
  { href: "/caja", label: "Caja", mobileLabel: "Caja", icon: CircleDollarSign },
] as const;

export function AppNavigation({ canUseAi }: { canUseAi: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="app-navigation" aria-label="Navegación principal">
      {links.filter((link) => !("aiOnly" in link && link.aiOnly) || canUseAi).map(({ href, label, mobileLabel, icon, ...options }) => {
        const active = pathname === href || (["/productos", "/ventas", "/gastos", "/analisis", "/caja", "/deeta-ai"].includes(href) && pathname.startsWith(`${href}/`));
        return (
          <NavLink
            key={href}
            href={href}
            label={label}
            mobileLabel={mobileLabel}
            icon={icon}
            active={active}
            mobileHidden={"mobileHidden" in options && options.mobileHidden}
          />
        );
      })}
    </nav>
  );
}

type NavHref = (typeof links)[number]["href"];

// Every panel route is dynamic and shares (private)/loading.tsx, so the default
// viewport prefetch only downloads the loading shell. As soon as the user shows
// intent (hover, touch or keyboard focus) we upgrade that single link to a full
// prefetch: the page's RSC payload, data included, starts loading before the
// click and is kept in the client router cache (staleTimes.dynamic). We never
// full-prefetch every tab up front, to avoid querying all modules on each load.
function NavLink({ href, label, mobileLabel, icon: Icon, active, mobileHidden }: {
  href: NavHref;
  label: string;
  mobileLabel: string;
  icon: typeof House;
  active: boolean;
  mobileHidden: boolean;
}) {
  const [intent, setIntent] = useState(false);
  const showIntent = () => setIntent(true);

  return (
    <Link
      href={href}
      prefetch={intent ? true : null}
      className="nav-link"
      data-active={active || undefined}
      data-mobile-hidden={mobileHidden || undefined}
      onPointerEnter={showIntent}
      onTouchStart={showIntent}
      onFocus={showIntent}
    >
      {href === "/dashboard" ? (
        <>
          <DeetaIcon className="size-5 md:hidden" />
          <Icon className="hidden size-5 md:block" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
        </>
      ) : <Icon className="size-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />}
      <span className="md:hidden">{mobileLabel}</span><span className="hidden md:inline">{label}</span>
    </Link>
  );
}
