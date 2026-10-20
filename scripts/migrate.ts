// Aplica las migraciones pendientes de drizzle/ con el driver HTTP de Neon.
// `drizzle-kit migrate` no aplica nada con este driver, por eso existe este script.
// Registra cada migración en drizzle.__drizzle_migrations, igual que Drizzle.
// Cada sentencia se ejecuta por separado (Neon HTTP no mantiene transacciones
// entre llamadas): las migraciones de DEETA son aditivas para que sea seguro.
// Uso: npm run db:apply
import { neon } from "@neondatabase/serverless";
import { readMigrationFiles } from "drizzle-orm/migrator";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const sql = neon(databaseUrl);
console.log(`Base: ${new URL(databaseUrl).hostname}`);
await sql`create schema if not exists drizzle`;
await sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
// Como Drizzle, se compara por fecha de la migración y no por hash: el hash
// cambia si git convierte los saltos de línea del archivo.
const [{ last }] = await sql`select coalesce(max(created_at), 0)::bigint as last from drizzle.__drizzle_migrations` as Array<{ last: string }>;
const pending = readMigrationFiles({ migrationsFolder: "drizzle" }).filter((migration) => migration.folderMillis > Number(last));
if (pending.length === 0) console.log("No hay migraciones pendientes.");
for (const migration of pending) {
  const statements = migration.sql.map((statement) => statement.trim()).filter(Boolean);
  console.log(`Aplicando migración de ${new Date(migration.folderMillis).toISOString()} (${statements.length} sentencias)…`);
  for (const statement of statements) await sql.query(statement);
  await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${migration.hash}, ${migration.folderMillis})`;
}
console.log("Listo.");
