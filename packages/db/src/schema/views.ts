import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { savedViewTypeEnum } from "./enums";

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: savedViewTypeEnum("type").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  filterDefinition: jsonb("filter_definition"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
