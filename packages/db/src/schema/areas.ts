import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { EntityStatus, Source } from "./enums";

export const areas = sqliteTable(
  "areas",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    color: text("color"),
    status: text("status").$type<EntityStatus>().notNull().default("Active"),
    orderIndex: text("order_index").notNull(),
    createdBy: text("created_by").$type<Source>().notNull().default("web_ui"),
    agentId: text("agent_id"),
    requestId: text("request_id"),
    reason: text("reason"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("areas_name_unique_idx").on(table.name)]
);
