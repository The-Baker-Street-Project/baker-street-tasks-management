import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { SavedViewType } from "./enums";

export const savedViews = sqliteTable("saved_views", {
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
});
