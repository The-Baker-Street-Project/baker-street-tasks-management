import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "../test-helpers";
import type { Database } from "../client";
import type BetterSqlite3 from "better-sqlite3";

describe("SQLite test infrastructure", () => {
  let db: Database;
  let client: BetterSqlite3.Database;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, client, cleanup } = await createTestDb());
  });

  afterAll(async () => {
    await cleanup();
  });

  it("should connect and run a simple query", () => {
    const result = db.get(sql`SELECT 1 AS ok`);
    expect(result).toEqual({ ok: 1 });
  });

  it("should have the tasks table from migrations", () => {
    const result = db.get(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'`
    );
    expect(result).toEqual({ name: "tasks" });
  });
});
