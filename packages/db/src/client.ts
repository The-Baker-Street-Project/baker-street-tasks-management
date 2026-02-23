import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema/index";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: PGlite | null = null;

export function createDb(dataDir?: string) {
  if (_db) return _db;
  const dir = dataDir ?? process.env.PGLITE_DATA_DIR ?? "./data/pglite";
  _client = new PGlite(dir);
  _db = drizzle({ client: _client, schema });
  return _db;
}

/** Expose the raw PGlite instance for LISTEN/NOTIFY and direct SQL. */
export function getPgliteClient(): PGlite {
  if (!_client) createDb();
  return _client!;
}

export type Database = ReturnType<typeof createDb>;
