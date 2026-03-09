import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "../../test-helpers";
import { tags } from "../../schema/index";
import { getAllTags } from "../../queries/tags";
import type { Database } from "../../client";
import type { PGlite } from "@electric-sql/pglite";

describe("Tag queries", () => {
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
    await db.delete(tags);
  });

  it("should return tags sorted by name", async () => {
    await db.insert(tags).values([
      { name: "Zebra", color: "#000" },
      { name: "Alpha", color: "#fff" },
    ]);

    const result = await getAllTags(db);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alpha");
    expect(result[1].name).toBe("Zebra");
  });

  it("should return empty array when no tags exist", async () => {
    const result = await getAllTags(db);
    expect(result).toHaveLength(0);
  });
});
