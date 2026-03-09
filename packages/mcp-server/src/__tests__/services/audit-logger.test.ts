import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { auditLog } from "@baker-street/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "../../services/audit-logger";
import type { Database } from "@baker-street/db/client";

describe("Audit logger", () => {
  let db: Database;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await db.delete(auditLog);
  });

  it("should insert an audit log entry and return its ID", async () => {
    const id = await logAudit(db, {
      entityType: "task",
      entityId: "00000000-0000-0000-0000-000000000001",
      action: "tasks.create",
      before: null,
      after: { title: "New task" },
      agentId: "test-agent",
      requestId: "req-1",
      reason: "Testing",
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe("string");

    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("task");
    expect(rows[0].action).toBe("tasks.create");
    expect(rows[0].actorType).toBe("ai");
    expect(rows[0].before).toBeNull();
    expect(rows[0].after).toEqual({ title: "New task" });
  });

  it("should store before and after snapshots as JSON", async () => {
    const before = { title: "Old", status: "Active" };
    const after = { title: "Updated", status: "Done" };

    const id = await logAudit(db, {
      entityType: "task",
      entityId: "00000000-0000-0000-0000-000000000001",
      action: "tasks.update",
      before,
      after,
    });

    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
    expect(rows[0].before).toEqual(before);
    expect(rows[0].after).toEqual(after);
  });
});
