import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import {
  captureStatusEnum,
  contextEnum,
  sourceEnum,
} from "./enums";

export const captures = pgTable(
  "captures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body"),
    status: captureStatusEnum("status").notNull().default("Captured"),
    pinned: boolean("pinned").notNull().default(false),
    context: contextEnum("context"),
    source: sourceEnum("source").notNull().default("web_ui"),
    nudgeAt: timestamp("nudge_at", { withTimezone: true }),
    // AI metadata
    createdBy: sourceEnum("created_by").notNull().default("web_ui"),
    agentId: text("agent_id"),
    sourceMessageId: text("source_message_id"),
    requestId: text("request_id"),
    reason: text("reason"),
    // Note: search_vector tsvector column + GIN index added via custom migration
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("captures_status_idx").on(table.status),
    index("captures_pinned_idx").on(table.pinned),
    index("captures_context_idx").on(table.context),
  ]
);
