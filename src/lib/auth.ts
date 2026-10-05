import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDb } from "@/db";
import { authSchema } from "@/db/schema";
import { getServerEnv } from "@/lib/env";

function createAuth() {
  const serverEnv = getServerEnv();
  return betterAuth({
    appName: "DEETA",
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    secret: serverEnv.BETTER_AUTH_SECRET,
    baseURL: serverEnv.BETTER_AUTH_URL,
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
