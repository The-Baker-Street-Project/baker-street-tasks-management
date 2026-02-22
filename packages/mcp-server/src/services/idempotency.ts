import { eq } from "drizzle-orm";
import { auditLog } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";

/**
 * Check whether a request_id has already been processed.
 * If so, return the `after` snapshot from the first matching audit entry.
 * Returns null if no prior entry exists for this request_id.
 */
export async function checkIdempotency(
  db: Database,
  requestId: string | undefined,
): Promise<{ alreadyProcessed: true; result: unknown } | { alreadyProcessed: false }> {
  if (!requestId) {
    return { alreadyProcessed: false };
  }

  const existing = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.requestId, requestId))
    .limit(1);

  if (existing.length > 0) {
    return { alreadyProcessed: true, result: existing[0].after };
  }

  return { alreadyProcessed: false };
}
