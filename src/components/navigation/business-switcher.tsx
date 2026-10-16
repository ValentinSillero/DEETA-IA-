import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";

import { switchBusinessAction } from "@/actions/team";
import type { MembershipOption } from "@/data/membership";
import { ROLE_LABELS } from "@/lib/permissions";

// Negocio activo y, si la persona pertenece a varios, la opción de cambiar.
// Al cambiar se recalculan rol, permisos y navegación en el servidor.
export function BusinessSwitcher({ current, memberships, settingsHref }: { current: { name: string; roleLabel: string }; memberships: MembershipOption[]; settingsHref: "/configuracion/negocio" | null }) {
  const others = memberships.filter((membership) => !membership.isCurrent);
  const label = (
    <>
      <span className="text-xs font-semibold text-subtle">Negocio · {current.roleLabel}</span>
      <span className="truncate font-display text-base font-bold text-ink">{current.name}</span>
    </>
  );
  if (others.length === 0) {
    return settingsHref
      ? <Link href={settingsHref} className="mx-3 flex min-w-0 flex-col rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2">{label}</Link>
      : <div className="mx-3 flex min-w-0 flex-col px-2.5 py-2">{label}</div>;
  }
  return (
    <details key={current.name} className="group mx-3 rounded-lg">
      <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2">
        <span className="flex min-w-0 flex-1 flex-col">{label}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="sr-only">Cambiar de negocio</span>
      </summary>
      <ul className="mt-1 grid gap-0.5 rounded-lg border border-line bg-surface p-1">
        {others.map((membership) => (
          <li key={membership.businessId}>
            <form action={switchBusinessAction}>
              <input type="hidden" name="businessId" value={membership.businessId} />
              <button type="submit" className="flex min-h-11 w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-surface-2">
                <span className="truncate text-sm font-semibold">{membership.businessName}</span>
                <span className="text-xs text-muted">{ROLE_LABELS[membership.role]}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}
