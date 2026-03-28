import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: BetterSqlite3.Database | null = null;
let _dbPath: string | null = null;

export function createDb(dbPath?: string) {
  const resolvedPath =
    dbPath ?? process.env.SQLITE_DB_PATH ?? "./data/tasks.db";
  if (_db) {
    if (_dbPath !== resolvedPath) {
      throw new Error(
        `SQLite already initialized with "${_dbPath}", cannot re-initialize with "${resolvedPath}"`
      );
    }
    return _db;
  }
  _sqlite = new BetterSqlite3(resolvedPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _db = drizzle(_sqlite, { schema });
  _dbPath = resolvedPath;
  return _db;
}

/** Expose the raw better-sqlite3 instance for direct SQL (FTS5, pragmas, etc). */
export function getSqliteClient(): BetterSqlite3.Database {
  if (!_sqlite) createDb();
  return _sqlite!;
}

export type Database = ReturnType<typeof createDb>;
