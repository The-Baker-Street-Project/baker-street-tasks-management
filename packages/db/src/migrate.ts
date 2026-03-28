import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createDb } from "./client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../drizzle");

/** Run migrations on any drizzle instance (used by test helpers). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function runMigrationsOnDb(db: BetterSQLite3Database<any>): void {
  migrate(db, { migrationsFolder });
}

export function runMigrations(dbPath?: string) {
  runMigrationsOnDb(createDb(dbPath));
}
