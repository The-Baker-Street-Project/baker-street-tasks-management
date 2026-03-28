import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../test-helpers";
import { savedViews } from "../schema/index";
import type { Database } from "../client";
import type BetterSqlite3 from "better-sqlite3";

describe("Seed script", () => {
  let db: Database;
  let client: BetterSqlite3.Database;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, client, cleanup } = await createTestDb());
  });

  afterAll(async () => {
    await cleanup();
  });

  it("should create 4 system views", async () => {
    const { seedDb } = await import("../seed");
    await seedDb(db);

    const views = await db.select().from(savedViews);
    expect(views.length).toBe(4);
    expect(views.map((v) => v.name).sort()).toEqual([
      "Active",
      "All Tasks",
      "Inbox",
      "Someday",
    ]);
  });

  it("should be idempotent — running twice produces same result", async () => {
    const { seedDb } = await import("../seed");
    await seedDb(db);
    await seedDb(db);

    const views = await db.select().from(savedViews);
    expect(views.length).toBe(4);
  });
});
