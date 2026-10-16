import type { MemberRole } from "@/db/schema";
import { hasPermission } from "@/lib/permissions";

// Señales reales del negocio. Todo el progreso se deriva de estos datos:
// no se guarda ningún "paso completado" manualmente.
export type OnboardingSignals = {
  hasProducts: boolean;
  hasStock: boolean;
  hasCashActivity: boolean;
  hasSales: boolean;
  hasExpenses: boolean;
  firstProductAt: Date | null;
  firstCashAt: Date | null;
  firstSaleAt: Date | null;
};

export type OnboardingPreference = "minimized" | "dismissed" | null;

export type OnboardingStepId = "products" | "cash" | "sale";
export type OnboardingStepStatus = "done" | "next" | "pending" | "blocked";

export type OnboardingAction = { label: string; href: string; variant: "primary" | "secondary" };

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  doneLabel: string;
  status: OnboardingStepStatus;
  actions: OnboardingAction[];
};

export type OnboardingExtra = {
  id: "expenses" | "ai" | "customers" | "team";
  title: string;
  description: string;
  action: OnboardingAction;
};

export type OnboardingMode = "checklist" | "minimized" | "completed" | "hidden";

export type OnboardingPlan = {
  mode: OnboardingMode;
  steps: OnboardingStep[];
  completed: number;
  total: number;
  extras: OnboardingExtra[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Un negocio que vende hace más de dos semanas ya está operando: no se le
// vuelve a mostrar el onboarding aunque, por ejemplo, nunca haya usado caja.
export const ESTABLISHED_AFTER_DAYS = 14;
// El mensaje "Todo listo" se muestra unos días después de completar los pasos.
export const COMPLETED_VISIBLE_DAYS = 3;

export function canManageCatalog(role: MemberRole) {
  return hasPermission(role, "PRODUCT_CREATE");
}

export function canUseAi(role: MemberRole) {
  return hasPermission(role, "PROFITABILITY_VIEW");
}

function latest(dates: Array<Date | null>) {
  const times = dates.filter((date): date is Date => date !== null).map((date) => date.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}

export function buildOnboardingPlan(input: {
  signals: OnboardingSignals;
  role: MemberRole;
  preference: OnboardingPreference;
  now: Date;
}): OnboardingPlan {
  const { signals, role, preference, now } = input;
  const manageCatalog = canManageCatalog(role);
  const productsNeedStock = signals.hasProducts && !signals.hasStock;

  const raw: Array<Omit<OnboardingStep, "status"> & { done: boolean; blocked: boolean }> = [
    {
      id: "products",
      title: productsNeedStock ? "Cargá el stock de tus productos" : "Cargá tus primeros productos",
      description: productsNeedStock
        ? "Tus productos todavía no tienen unidades disponibles. Indicá cuántas tenés para poder venderlas."
        : manageCatalog
          ? "Agregá lo que vendés con su precio y stock. Si los tenés en Excel, podés cargarlos todos juntos."
          : "Pedile a quien administra el negocio que cargue los productos.",
      doneLabel: "Productos y stock cargados",
      done: signals.hasProducts && signals.hasStock,
      blocked: !manageCatalog,
      actions: !manageCatalog
        ? []
        : productsNeedStock
          ? [{ label: "Cargar stock", href: "/productos?estado=out", variant: "primary" }]
          : [
              { label: "Agregar producto", href: "/productos/nuevo", variant: "primary" },
              { label: "Importar desde Excel", href: "/productos/importar", variant: "secondary" },
            ],
    },
    {
      id: "cash",
      title: "Abrí tu primera caja",
      description: "Indicá con cuánto efectivo empezás el día. Así DEETA controla lo que entra y sale.",
      doneLabel: "Primera caja abierta",
      done: signals.hasCashActivity,
      blocked: false,
      actions: [{ label: "Abrir caja", href: "/caja", variant: "primary" }],
    },
    {
      id: "sale",
      title: "Registrá tu primera venta",
      description: signals.hasStock
        ? "Probá el flujo completo de venta con uno de tus productos."
        : "Cuando tengas productos con stock, vas a poder registrar tu primera venta.",
      doneLabel: "Primera venta registrada",
      done: signals.hasSales,
      blocked: !signals.hasStock,
      actions: signals.hasStock ? [{ label: "Nueva venta", href: "/vender", variant: "primary" }] : [],
    },
  ];

  let nextAssigned = false;
  const steps: OnboardingStep[] = raw.map(({ done, blocked, ...step }) => {
    let status: OnboardingStepStatus;
    if (done) status = "done";
    else if (blocked) status = "blocked";
    else if (!nextAssigned) { status = "next"; nextAssigned = true; }
    else status = "pending";
    return { ...step, status };
  });

  const completed = steps.filter((step) => step.status === "done").length;
  const total = steps.length;

  const extras: OnboardingExtra[] = [];
  if (!signals.hasExpenses && hasPermission(role, "EXPENSE_CREATE")) {
    extras.push({
      id: "expenses",
      title: "Registrá tus gastos",
      description: "Así DEETA puede calcular mejor el resultado de tu negocio.",
      action: { label: "Anotar gasto", href: "/gastos/nuevo", variant: "secondary" },
    });
  }
  if (signals.hasSales && hasPermission(role, "TEAM_INVITE")) {
    extras.push({
      id: "team",
      title: "¿Trabajás con otras personas?",
      description: "Podés invitarlas y elegir qué puede hacer cada una.",
      action: { label: "Invitar al equipo", href: "/configuracion/equipo", variant: "secondary" },
    });
  }
  if (signals.hasSales && hasPermission(role, "CUSTOMER_VIEW")) {
    extras.push({
      id: "customers",
      title: "¿Vendés fiado?",
      description: "Podés llevar las cuentas de tus clientes desde DEETA.",
      action: { label: "Ver clientes", href: "/clientes", variant: "secondary" },
    });
  }
  if (canUseAi(role) && signals.hasSales) {
    extras.push({
      id: "ai",
      title: "Probá DEETA AI",
      description: "Preguntale, por ejemplo: “¿Qué productos se vendieron más?”",
      action: { label: "Preguntarle a DEETA", href: "/deeta-ai", variant: "secondary" },
    });
  }

  let mode: OnboardingMode;
  if (completed === total) {
    const completedAt = latest([signals.firstProductAt, signals.firstCashAt, signals.firstSaleAt]);
    const recent = completedAt !== null && now.getTime() - completedAt.getTime() < COMPLETED_VISIBLE_DAYS * DAY_MS;
    mode = recent && preference !== "dismissed" ? "completed" : "hidden";
  } else {
    const established = signals.firstSaleAt !== null
      && now.getTime() - signals.firstSaleAt.getTime() >= ESTABLISHED_AFTER_DAYS * DAY_MS;
    if (established) mode = "hidden";
    else mode = preference === "minimized" || preference === "dismissed" ? "minimized" : "checklist";
  }

  return { mode, steps, completed, total, extras };
}

// Preferencia visual (minimizar/cerrar) por negocio, guardada en una cookie.
// No define el progreso: solo cómo se muestra el bloque.
export const ONBOARDING_COOKIE = "deeta_onboarding";
const MAX_COOKIE_ENTRIES = 20;
const PREFERENCE_CODES = { minimized: "m", dismissed: "d" } as const;

export function parseOnboardingCookie(value: string | undefined): Map<string, Exclude<OnboardingPreference, null>> {
  const entries = new Map<string, Exclude<OnboardingPreference, null>>();
  if (!value) return entries;
  for (const part of value.split("|").slice(0, MAX_COOKIE_ENTRIES)) {
    const [businessId, code] = part.split(":");
    if (!businessId || !/^[\w-]{1,100}$/.test(businessId)) continue;
    if (code === PREFERENCE_CODES.minimized) entries.set(businessId, "minimized");
    else if (code === PREFERENCE_CODES.dismissed) entries.set(businessId, "dismissed");
  }
  return entries;
}

export function serializeOnboardingCookie(
  current: string | undefined,
  businessId: string,
  preference: OnboardingPreference,
) {
  const entries = parseOnboardingCookie(current);
  entries.delete(businessId);
  if (preference) entries.set(businessId, preference);
  return [...entries]
    .slice(-MAX_COOKIE_ENTRIES)
    .map(([id, value]) => `${id}:${PREFERENCE_CODES[value]}`)
    .join("|");
}
