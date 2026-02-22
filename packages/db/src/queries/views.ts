import { asc } from "drizzle-orm";
import { savedViews } from "../schema/views";
import type { Database } from "../client";

export async function getAllSavedViews(db: Database) {
  return db.select().from(savedViews).orderBy(asc(savedViews.sortOrder));
}
