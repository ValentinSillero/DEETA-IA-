import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { getSqlClient } from "@/db";
import type { MemberRole } from "@/db/schema";
import {
  buildOnboardingPlan,
  ONBOARDING_COOKIE,
  parseOnboardingCookie,
  type OnboardingSignals,
} from "@/lib/onboarding";

export type BusinessOnboardingState = {
  businessId: string;
  role: MemberRole;
  signals: OnboardingSignals;
};

function toDate(value: unknown) {
  return value === null || value === undefined ? null : new Date(value as string | Date);
}

// Una sola consulta liviana: cada subconsulta usa índices que empiezan por
// business_id y se detiene en la primera fila. El negocio sale siempre de la
// membresía autenticada, nunca de un dato enviado por el navegador.
export const getBusinessOnboardingStateForUser = cache(async (userId: string): Promise<BusinessOnboardingState | null> => {
  const sql = getSqlClient();
  const rows = await sql`
    select
      bm.business_id,
      bm.role,
      (select min(p.created_at) from product p where p.business_id = bm.business_id) as first_product_at,
      exists (
        select 1 from product p
        where p.business_id = bm.business_id and p.is_active = true and p.current_stock > 0
      ) as has_stocked_product,
      exists (select 1 from stock_movement sm where sm.business_id = bm.business_id) as has_stock_movement,
      (select min(c.opened_at) from cash_session c where c.business_id = bm.business_id) as first_cash_at,
      (select min(s.created_at) from sale s where s.business_id = bm.business_id) as first_sale_at,
      exists (select 1 from expense e where e.business_id = bm.business_id) as has_expenses
    from business_member bm
    where bm.user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const firstProductAt = toDate(row.first_product_at);
  const firstCashAt = toDate(row.first_cash_at);
  const firstSaleAt = toDate(row.first_sale_at);
  return {
    businessId: String(row.business_id),
    role: String(row.role) as MemberRole,
    signals: {
      hasProducts: firstProductAt !== null,
      // Un producto con unidades, un movimiento de stock o una venta prueban
      // que el inventario ya se cargó alguna vez.
      hasStock: Boolean(row.has_stocked_product) || Boolean(row.has_stock_movement) || firstSaleAt !== null,
      hasCashActivity: firstCashAt !== null,
      hasSales: firstSaleAt !== null,
      hasExpenses: Boolean(row.has_expenses),
      firstProductAt,
      firstCashAt,
      firstSaleAt,
    },
  };
});

export async function getOnboardingPlanForUser(userId: string) {
  const [state, cookieStore] = await Promise.all([getBusinessOnboardingStateForUser(userId), cookies()]);
  if (!state) return null;
  const preference = parseOnboardingCookie(cookieStore.get(ONBOARDING_COOKIE)?.value).get(state.businessId) ?? null;
  return {
    state,
    plan: buildOnboardingPlan({ signals: state.signals, role: state.role, preference, now: new Date() }),
  };
}
