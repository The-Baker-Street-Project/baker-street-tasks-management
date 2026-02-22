import { auditLog } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";

export type EntityType = "task" | "subtask" | "capture" | "tag" | "saved_view";

export interface AuditEntry {
  entityType: EntityType;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  agentId?: string;
  requestId?: string;
  reason?: string;
}

/**
 * Write an audit log entry. All MCP writes use actor_type 'ai'.
 * Returns the created audit row id.
 */
export async function logAudit(db: Database, entry: AuditEntry): Promise<string> {
  const [row] = await db
    .insert(auditLog)
    .values({
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorType: "ai",
      agentId: entry.agentId ?? null,
      requestId: entry.requestId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      reason: entry.reason ?? null,
    })
    .returning({ id: auditLog.id });

  return row.id;
}
