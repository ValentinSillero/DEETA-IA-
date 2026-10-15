"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getBusinessForUser } from "@/data/businesses";
import { ONBOARDING_COOKIE, serializeOnboardingCookie, type OnboardingPreference } from "@/lib/onboarding";
import { requireFreshSession } from "@/lib/session";

const allowed = new Set<OnboardingPreference>(["minimized", "dismissed", null]);

export async function setOnboardingPreferenceAction(formData: FormData) {
  const session = await requireFreshSession();
  const raw = String(formData.get("preference") ?? "");
  const preference = (raw === "" ? null : raw) as OnboardingPreference;
  if (!allowed.has(preference)) return;
  // El negocio se resuelve desde la membresía autenticada.
  const context = await getBusinessForUser(session.user.id);
  if (!context) return;
  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_COOKIE, serializeOnboardingCookie(cookieStore.get(ONBOARDING_COOKIE)?.value, context.business.id, preference), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard");
}
