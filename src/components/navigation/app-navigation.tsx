"use client";

import { Bot, ChartNoAxesCombined, CircleDollarSign, House, Package, ReceiptText, ShoppingCart, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
      {links.filter((link) => !("aiOnly" in link && link.aiOnly) || canUseAi).map(({ href, label, mobileLabel, icon: Icon, ...options }) => {
        const active = pathname === href || (["/productos", "/ventas", "/gastos", "/analisis", "/caja", "/deeta-ai"].includes(href) && pathname.startsWith(`${href}/`));
        return (
          <Link key={href} href={href} className="nav-link" data-active={active || undefined} data-mobile-hidden={("mobileHidden" in options && options.mobileHidden) || undefined}>
            {href === "/dashboard" ? (
              <>
                <DeetaIcon className="size-5 md:hidden" />
                <Icon className="hidden size-5 md:block" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
              </>
            ) : <Icon className="size-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />}
            <span className="md:hidden">{mobileLabel}</span><span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
