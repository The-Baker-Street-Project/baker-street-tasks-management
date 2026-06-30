import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { SavedViewType } from "./enums";

export const savedViews = sqliteTable(
  "saved_views",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    type: text("type").$type<SavedViewType>().notNull(),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
    filterDefinition: text("filter_definition", { mode: "json" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  // System views must be unique by (name, type). Partial index so user-created
  // views are unconstrained — the seed re-inserts system views idempotently and
  // this prevents the duplicate-views bug structurally.
  (table) => [
    uniqueIndex("saved_views_system_name_type_unique_idx")
      .on(table.name, table.type)
      .where(sql`${table.isSystem} = 1`),
  ]
);
