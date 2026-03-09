import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { auditLog } from "@baker-street/db/schema";
import { checkIdempotency } from "../../services/idempotency";
import { logAudit } from "../../services/audit-logger";
import type { Database } from "@baker-street/db/client";

describe("Idempotency service", () => {
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

  it("should return alreadyProcessed=false for new request_id", async () => {
    const result = await checkIdempotency(db, "new-request-123");
    expect(result.alreadyProcessed).toBe(false);
  });

  it("should return alreadyProcessed=false when request_id is undefined", async () => {
    const result = await checkIdempotency(db, undefined);
    expect(result.alreadyProcessed).toBe(false);
  });

  it("should return alreadyProcessed=true for duplicate request_id", async () => {
    await logAudit(db, {
      entityType: "task",
      entityId: "00000000-0000-0000-0000-000000000001",
      action: "tasks.create",
      before: null,
      after: { title: "Test" },
      requestId: "duplicate-123",
    });

    const result = await checkIdempotency(db, "duplicate-123");
    expect(result.alreadyProcessed).toBe(true);
    if (result.alreadyProcessed) {
      expect(result.result).toBeDefined();
    }
  });
});
