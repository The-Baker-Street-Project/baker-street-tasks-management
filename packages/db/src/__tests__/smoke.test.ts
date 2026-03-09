import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "../test-helpers";
import type { Database } from "../client";
import type { PGlite } from "@electric-sql/pglite";

describe("PGlite test infrastructure", () => {
  let db: Database;
  let client: PGlite;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, client, cleanup } = await createTestDb());
  });

  afterAll(async () => {
    await cleanup();
  });

  it("should connect and run a simple query", async () => {
    const result = await db.execute(sql`SELECT 1 AS ok`);
    expect(result.rows[0].ok).toBe(1);
  });

  it("should have the tasks table from migrations", async () => {
    const result = await db.execute(
      sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks')`
    );
    expect(result.rows[0].exists).toBe(true);
  });
});
