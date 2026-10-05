import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env";

function createConnection() {
  const serverEnv = getServerEnv();
  const sqlClient = neon(serverEnv.DATABASE_URL);
  const db = drizzle({ client: sqlClient, schema });
  return { db, sqlClient };
}

let connection: ReturnType<typeof createConnection> | undefined;

function getConnection() {
  connection ??= createConnection();
  return connection;
}

export function getDb() {
  return getConnection().db;
}

export function getSqlClient() {
  return getConnection().sqlClient;
}
