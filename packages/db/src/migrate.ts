import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { createDb } from "./client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../drizzle");

/** Run migrations on any drizzle instance (used by test helpers). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runMigrationsOnDb(db: PgliteDatabase<any>): Promise<void> {
  await migrate(db, { migrationsFolder });
}

export async function runMigrations(dataDir?: string) {
  await runMigrationsOnDb(createDb(dataDir));
}
