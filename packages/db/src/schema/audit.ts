import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { EntityType, ActorType } from "./enums";

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    actorType: text("actor_type").$type<ActorType>().notNull().default("user"),
    agentId: text("agent_id"),
    requestId: text("request_id"),
    before: text("before", { mode: "json" }),
    after: text("after", { mode: "json" }),
    reason: text("reason"),
    undone: integer("undone", { mode: "boolean" }).notNull().default(false),
    undoneByAuditId: text("undone_by_audit_id"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("audit_entity_idx").on(table.entityType, table.entityId),
    index("audit_request_id_idx").on(table.requestId),
    index("audit_created_at_idx").on(table.createdAt),
  ]
);
