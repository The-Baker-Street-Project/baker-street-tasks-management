import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema/index";
import type { Database } from "./client";

export async function createTestDb(): Promise<{
  db: Database;
  client: PGlite;
  cleanup: () => Promise<void>;
}> {
  const client = new PGlite();

  // Raw drizzle instance (no schema) for the migrator — avoids type mismatch
  const rawDb = drizzle(client);
  const { runMigrationsOnDb } = await import("./migrate");
  await runMigrationsOnDb(rawDb);

  // Schema-typed instance for test queries
  const db = drizzle(client, { schema }) as unknown as Database;

  return {
    db,
    client,
    cleanup: async () => {
      await client.close();
    },
  };
}
