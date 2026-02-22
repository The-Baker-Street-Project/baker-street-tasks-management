import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { entityTypeEnum, actorTypeEnum } from "./enums";

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    actorType: actorTypeEnum("actor_type").notNull().default("user"),
    agentId: text("agent_id"),
    requestId: text("request_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    undone: boolean("undone").notNull().default(false),
    undoneByAuditId: uuid("undone_by_audit_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_entity_idx").on(table.entityType, table.entityId),
    index("audit_request_id_idx").on(table.requestId),
    index("audit_created_at_idx").on(table.createdAt),
  ]
);
