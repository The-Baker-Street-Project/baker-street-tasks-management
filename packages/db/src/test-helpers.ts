import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index";
import type { Database } from "./client";

export async function createTestDb(): Promise<{
  db: Database;
  client: BetterSqlite3.Database;
  cleanup: () => Promise<void>;
}> {
  // In-memory database for tests
  const client = new BetterSqlite3(":memory:");
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");

  // Raw drizzle instance (no schema) for the migrator — avoids type mismatch
  const rawDb = drizzle(client);
  const { runMigrationsOnDb } = await import("./migrate");
  runMigrationsOnDb(rawDb);

  // Schema-typed instance for test queries
  const db = drizzle(client, { schema }) as unknown as Database;

  return {
    db,
    client,
    cleanup: async () => {
      client.close();
    },
  };
}
