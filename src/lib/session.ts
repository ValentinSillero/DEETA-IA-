import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getAuth } from "@/lib/auth";

async function resolveSession(disableCookieCache: boolean) {
  await connection();
  return getAuth().api.getSession({
    headers: await headers(),
    query: disableCookieCache ? { disableCookieCache: true } : undefined,
  });
}

// Page renders may use Better Auth's short-lived, encrypted cookie cache.
// Mutations and API handlers use getFreshSession/requireFreshSession below.
export const getSession = cache(() => resolveSession(false));
export const getFreshSession = cache(() => resolveSession(true));

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/iniciar-sesion");
  return session;
}

export async function requireFreshSession() {
  const session = await getFreshSession();
  if (!session) redirect("/iniciar-sesion");
  return session;
}
