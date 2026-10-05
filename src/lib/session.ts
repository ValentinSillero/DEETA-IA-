import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getAuth } from "@/lib/auth";

export async function getSession() {
  await connection();
  return getAuth().api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/iniciar-sesion");
  return session;
}
