import { asc } from "drizzle-orm";
import { tags } from "../schema/tags";
import type { Database } from "../client";

export async function getAllTags(db: Database) {
  return db.select().from(tags).orderBy(asc(tags.name));
}
