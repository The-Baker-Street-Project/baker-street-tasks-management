"use server";

import { createDb } from "@baker-street/db/client";
import {
  captures,
  captureTags,
  tags,
  tasks,
} from "@baker-street/db/schema";
import { eq, and, or, ilike, asc, desc, ne } from "drizzle-orm";
import type { Capture, CaptureStatus, Context, Source } from "@/types";

function getDb() {
  return createDb();
}

function mapCapture(
  row: typeof captures.$inferSelect & {
    captureTags?: { tag: typeof tags.$inferSelect }[];
  }
): Capture {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status as CaptureStatus,
    pinned: row.pinned,
    context: row.context as Context | null,
    source: row.source as Source,
    nudgeAt: row.nudgeAt,
    createdBy: row.createdBy as Source,
    agentId: row.agentId,
    sourceMessageId: row.sourceMessageId,
    requestId: row.requestId,
    reason: row.reason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: row.captureTags?.map((ct) => ({
      id: ct.tag.id,
      name: ct.tag.name,
      color: ct.tag.color,
      createdAt: ct.tag.createdAt,
    })),
  };
}

export interface GetCapturesParams {
  status?: CaptureStatus[];
  pinned?: boolean;
  tab?: "recent" | "pinned" | "reviewed" | "archived";
  context?: Context | null;
}

export async function getCaptures(
  params?: GetCapturesParams
): Promise<Capture[]> {
  const db = getDb();

  const conditions = [];

  if (params?.status && params.status.length > 0) {
    if (params.status.length === 1) {
      conditions.push(eq(captures.status, params.status[0]));
    } else {
      conditions.push(
        or(...params.status.map((s) => eq(captures.status, s)))
      );
    }
  }

  if (params?.pinned !== undefined) {
    conditions.push(eq(captures.pinned, params.pinned));
  }

  // Map tab to filters
  if (params?.tab) {
    switch (params.tab) {
      case "pinned":
        conditions.push(eq(captures.pinned, true));
        break;
      case "reviewed":
        conditions.push(eq(captures.status, "Reviewed"));
        break;
      case "archived":
        conditions.push(eq(captures.status, "Archived"));
        break;
      case "recent":
      default:
        conditions.push(ne(captures.status, "Archived"));
        break;
    }
  }

  if (params?.context) {
    conditions.push(eq(captures.context, params.context));
  }

  const rows = await db.query.captures.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      captureTags: { with: { tag: true } },
    },
    orderBy: desc(captures.createdAt),
  });

  return rows.map(mapCapture);
}

export async function getCapture(id: string): Promise<Capture | null> {
  const db = getDb();
  const row = await db.query.captures.findFirst({
    where: eq(captures.id, id),
    with: {
      captureTags: { with: { tag: true } },
    },
  });
  if (!row) return null;
  return mapCapture(row);
}

export interface CreateCaptureInput {
  title: string;
  body?: string | null;
  context?: Context | null;
}

export async function createCapture(data: CreateCaptureInput): Promise<Capture> {
  const db = getDb();
  const [row] = await db
    .insert(captures)
    .values({
      title: data.title,
      body: data.body ?? null,
      context: data.context ?? null,
      createdBy: "web_ui",
      source: "web_ui",
    })
    .returning();

  const result = await getCapture(row.id);
  return result!;
}

export interface UpdateCaptureInput {
  title?: string;
  body?: string | null;
  status?: CaptureStatus;
  pinned?: boolean;
  context?: Context | null;
  nudgeAt?: Date | null;
}

export async function updateCapture(
  id: string,
  data: UpdateCaptureInput
): Promise<Capture> {
  const db = getDb();
  await db
    .update(captures)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(captures.id, id));
  const result = await getCapture(id);
  return result!;
}

export async function deleteCapture(id: string): Promise<void> {
  const db = getDb();
  await db.delete(captures).where(eq(captures.id, id));
}

export async function promoteCapture(
  captureId: string,
  taskData: {
    title: string;
    notes?: string | null;
    status?: string;
    priority?: string;
    context?: Context | null;
  }
): Promise<{ taskId: string }> {
  const db = getDb();
  const capture = await getCapture(captureId);
  if (!capture) throw new Error("Capture not found");

  const orderIndex = Date.now().toString(36);

  const [taskRow] = await db
    .insert(tasks)
    .values({
      title: taskData.title || capture.title,
      notes: taskData.notes ?? capture.body,
      status: (taskData.status as "Inbox" | "Active") ?? "Inbox",
      priority: (taskData.priority as "P0" | "P1" | "P2" | "P3") ?? "P3",
      context: taskData.context ?? capture.context,
      orderIndex,
      createdBy: "web_ui",
    })
    .returning();

  await db
    .update(captures)
    .set({ status: "Archived", updatedAt: new Date() })
    .where(eq(captures.id, captureId));

  return { taskId: taskRow.id };
}

export async function getPinnedCaptures(): Promise<Capture[]> {
  const db = getDb();
  const rows = await db.query.captures.findMany({
    where: and(
      eq(captures.pinned, true),
      ne(captures.status, "Archived")
    ),
    with: {
      captureTags: { with: { tag: true } },
    },
    orderBy: desc(captures.createdAt),
  });
  return rows.map(mapCapture);
}

export async function searchCaptures(query: string): Promise<Capture[]> {
  const db = getDb();
  const rows = await db.query.captures.findMany({
    where: or(
      ilike(captures.title, `%${query}%`),
      ilike(captures.body, `%${query}%`)
    ),
    with: {
      captureTags: { with: { tag: true } },
    },
    orderBy: desc(captures.updatedAt),
    limit: 50,
  });
  return rows.map(mapCapture);
}

// ── Tag actions ───────────────────────────────────────────────

export async function addTagToCapture(
  captureId: string,
  tagId: string
): Promise<void> {
  const db = getDb();
  await db
    .insert(captureTags)
    .values({ captureId, tagId })
    .onConflictDoNothing();
}

export async function removeTagFromCapture(
  captureId: string,
  tagId: string
): Promise<void> {
  const db = getDb();
  await db
    .delete(captureTags)
    .where(and(eq(captureTags.captureId, captureId), eq(captureTags.tagId, tagId)));
}
