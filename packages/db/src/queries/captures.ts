import { eq, and, sql, asc, desc } from "drizzle-orm";
import { captures } from "../schema/captures";
import { captureTags } from "../schema/tags";
import type { Database } from "../client";

export async function getCaptureById(db: Database, id: string) {
  const rows = await db
    .select()
    .from(captures)
    .where(eq(captures.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const capture = rows[0];
  const tags = await db
    .select()
    .from(captureTags)
    .where(eq(captureTags.captureId, id));
  return { ...capture, tagIds: tags.map((t) => t.tagId) };
}

export async function getPinnedCaptures(db: Database, limit = 10) {
  return db
    .select()
    .from(captures)
    .where(and(eq(captures.pinned, true), eq(captures.status, "Captured")))
    .orderBy(desc(captures.createdAt))
    .limit(limit);
}

export async function searchCapturesFts(
  db: Database,
  query: string,
  limit = 20,
) {
  return db
    .select()
    .from(captures)
    .where(sql`search_vector @@ plainto_tsquery('english', ${query})`)
    .orderBy(
      sql`ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC`,
    )
    .limit(limit);
}
