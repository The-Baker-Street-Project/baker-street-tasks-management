import { eq, and, or, lt, gte, lte, sql, desc, asc, inArray } from "drizzle-orm";
import { tasks } from "../schema/tasks";
import { subtasks } from "../schema/subtasks";
import { taskTags } from "../schema/tags";
import type { Database } from "../client";

export async function getTaskById(db: Database, id: string) {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (rows.length === 0) return null;
  const task = rows[0];
  const subs = await db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, id))
    .orderBy(asc(subtasks.orderIndex));
  const tags = await db.select().from(taskTags).where(eq(taskTags.taskId, id));
  return { ...task, subtasks: subs, tagIds: tags.map((t) => t.tagId) };
}

export async function getOverdueTasks(db: Database, limit = 10) {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        lt(tasks.dueAt, new Date()),
        or(
          eq(tasks.status, "Inbox"),
          eq(tasks.status, "Active"),
          eq(tasks.status, "Someday"),
        ),
      ),
    )
    .orderBy(asc(tasks.dueAt))
    .limit(limit);
}

export async function getDueTodayTasks(db: Database) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.dueAt, startOfDay),
        lt(tasks.dueAt, endOfDay),
        or(
          eq(tasks.status, "Inbox"),
          eq(tasks.status, "Active"),
          eq(tasks.status, "Someday"),
        ),
      ),
    )
    .orderBy(asc(tasks.dueAt));
}

export async function getHighPriorityTasks(db: Database, limit = 10) {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        inArray(tasks.priority, ["P0", "P1"]),
        or(
          eq(tasks.status, "Inbox"),
          eq(tasks.status, "Active"),
          eq(tasks.status, "Someday"),
        ),
      ),
    )
    .orderBy(asc(tasks.priority), asc(tasks.orderIndex))
    .limit(limit);
}

export async function getFocusTasks(db: Database, limit = 3) {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.isFocus, true),
        or(
          eq(tasks.status, "Inbox"),
          eq(tasks.status, "Active"),
          eq(tasks.status, "Someday"),
        ),
      ),
    )
    .orderBy(asc(tasks.orderIndex))
    .limit(limit);
}

export async function searchTasksFts(db: Database, query: string, limit = 20) {
  return db
    .select()
    .from(tasks)
    .where(sql`search_vector @@ plainto_tsquery('english', ${query})`)
    .orderBy(
      sql`ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC`,
    )
    .limit(limit);
}
