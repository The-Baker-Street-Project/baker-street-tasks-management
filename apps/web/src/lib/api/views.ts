"use server";

import { createDb } from "@baker-street/db/client";
import { savedViews, tags } from "@baker-street/db/schema";
import { eq, asc } from "drizzle-orm";
import type { SavedView, Tag } from "@/types";

function getDb() {
  return createDb();
}

export async function getSavedViews(type?: string): Promise<SavedView[]> {
  const db = getDb();

  const conditions = type ? eq(savedViews.type, type as "Tasks" | "KanbanLane") : undefined;

  const rows = await db.query.savedViews.findMany({
    where: conditions,
    orderBy: asc(savedViews.sortOrder),
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as SavedView["type"],
    isSystem: row.isSystem,
    isHidden: row.isHidden,
    filterDefinition: row.filterDefinition as Record<string, unknown> | null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function getTags(): Promise<Tag[]> {
  const db = getDb();
  const rows = await db.query.tags.findMany({
    orderBy: asc(tags.name),
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
  }));
}

export async function createTag(data: {
  name: string;
  color?: string;
}): Promise<Tag> {
  const db = getDb();
  const [row] = await db
    .insert(tags)
    .values({
      name: data.name,
      color: data.color ?? null,
    })
    .returning();
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
  };
}

export async function updateTag(
  id: string,
  data: Partial<{ name: string; color: string | null }>
): Promise<Tag> {
  const db = getDb();
  const [row] = await db
    .update(tags)
    .set(data)
    .where(eq(tags.id, id))
    .returning();
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
  };
}

export async function deleteTag(id: string): Promise<void> {
  const db = getDb();
  await db.delete(tags).where(eq(tags.id, id));
}
