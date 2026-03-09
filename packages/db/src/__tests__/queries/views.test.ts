import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "../../test-helpers";
import { savedViews } from "../../schema/index";
import { getAllSavedViews } from "../../queries/views";
import type { Database } from "../../client";
import type { PGlite } from "@electric-sql/pglite";

describe("View queries", () => {
  let db: Database;
  let client: PGlite;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, client, cleanup } = await createTestDb());
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await db.delete(savedViews);
  });

  it("should return views sorted by sortOrder", async () => {
    await db.insert(savedViews).values([
      { name: "B View", type: "Tasks", sortOrder: 2 },
      { name: "A View", type: "Tasks", sortOrder: 1 },
    ]);

    const result = await getAllSavedViews(db);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("A View");
    expect(result[1].name).toBe("B View");
  });

  it("should return empty array when no views exist", async () => {
    const result = await getAllSavedViews(db);
    expect(result).toHaveLength(0);
  });
});
