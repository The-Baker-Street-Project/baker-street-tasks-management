import { pathToFileURL } from "url";
import { generateKeyBetween } from "fractional-indexing";
import { createDb, getSqliteClient } from "./client";
import { setupFts } from "./fts";
import { tasks } from "./schema/tasks";
import { subtasks } from "./schema/subtasks";
import { tags, taskTags } from "./schema/tags";
import type { Database } from "./client";

/**
 * Seeds a realistic mix of sample data so the app can be exercised:
 * overdue / due-today / upcoming tasks, every status and priority, focus
 * tasks, tags, and subtasks. Re-runnable — wipes all tasks and tags first.
 *
 * Run with: pnpm --filter @baker-street/db exec tsx src/seed-sample.ts
 */
export async function seedSampleData(db: Database) {
  // FTS5 table + triggers (normally set up by the standalone server, not in dev).
  // Creating them before inserting means new rows sync into search automatically.
  setupFts(getSqliteClient());

  console.log("Clearing existing tasks and tags...");
  await db.delete(taskTags);
  await db.delete(subtasks);
  await db.delete(tasks); // cascades to subtasks/task_tags too, but explicit above is clearer
  await db.delete(tags);

  console.log("Inserting tags...");
  const tagRows = await db
    .insert(tags)
    .values([
      { name: "Work", color: "#3b82f6" },
      { name: "Home", color: "#10b981" },
      { name: "Errands", color: "#f59e0b" },
      { name: "Health", color: "#ef4444" },
      { name: "Finance", color: "#8b5cf6" },
      { name: "Reading", color: "#ec4899" },
    ])
    .returning();
  const tag = Object.fromEntries(tagRows.map((t) => [t.name, t.id])) as Record<
    string,
    string
  >;

  const day = 86_400_000;
  const now = Date.now();
  const iso = (offsetDays: number) =>
    new Date(now + offsetDays * day).toISOString();

  // Monotonic fractional order indexes.
  let lastIdx: string | null = null;
  const nextIdx = () => (lastIdx = generateKeyBetween(lastIdx, null));

  type Sample = {
    title: string;
    notes?: string;
    status: "Inbox" | "Active" | "Someday" | "Done" | "Archived";
    priority: "P0" | "P1" | "P2" | "P3";
    context?: "Home" | "Work";
    dueIn?: number; // days from now (negative = overdue)
    completedIn?: number;
    isFocus?: boolean;
    tags?: string[];
    subtasks?: { title: string; done?: boolean }[];
  };

  const samples: Sample[] = [
    {
      title: "Renew passport before it expires",
      notes: "Photos already taken. Need to fill form DS-82 and mail it.",
      status: "Active",
      priority: "P0",
      context: "Home",
      dueIn: -3,
      isFocus: true,
      tags: ["Home", "Errands"],
    },
    {
      title: "Call Lestrade re: evidence locker access",
      status: "Active",
      priority: "P0",
      context: "Work",
      dueIn: 0,
      isFocus: true,
      tags: ["Work"],
    },
    {
      title: "Buy milk, eggs, and coffee",
      status: "Active",
      priority: "P3",
      context: "Home",
      dueIn: 0,
      tags: ["Home", "Errands"],
    },
    {
      title: "Review Q2 product roadmap",
      notes: "Focus on the search and kanban milestones.",
      status: "Active",
      priority: "P1",
      context: "Work",
      dueIn: 2,
      isFocus: true,
      tags: ["Work"],
      subtasks: [
        { title: "Read the PRD", done: true },
        { title: "Leave comments on milestones" },
        { title: "Sync with design" },
      ],
    },
    {
      title: "Prepare 221B case notes",
      status: "Active",
      priority: "P1",
      context: "Work",
      dueIn: 1,
      tags: ["Work", "Reading"],
      subtasks: [
        { title: "Collate witness statements" },
        { title: "Cross-reference timeline" },
      ],
    },
    {
      title: "File quarterly estimated taxes",
      status: "Active",
      priority: "P1",
      context: "Home",
      dueIn: 10,
      tags: ["Finance"],
    },
    {
      title: "Schedule dentist appointment",
      status: "Inbox",
      priority: "P2",
      context: "Home",
      tags: ["Health"],
    },
    {
      title: "Reply to Mrs. Hudson about the rent",
      status: "Inbox",
      priority: "P2",
      context: "Home",
      tags: ["Home"],
    },
    {
      title: "Plan the weekend hike",
      notes: "Check the weather and trail conditions first.",
      status: "Inbox",
      priority: "P3",
      context: "Home",
    },
    {
      title: "Read 'The Sign of the Four'",
      status: "Someday",
      priority: "P3",
      context: "Home",
      tags: ["Reading"],
    },
    {
      title: "Fix the squeaky door hinge",
      status: "Someday",
      priority: "P3",
      context: "Home",
      tags: ["Home"],
    },
    {
      title: "Restring the violin",
      status: "Done",
      priority: "P3",
      context: "Home",
      completedIn: -1,
      tags: ["Home"],
    },
    {
      title: "Archive the Baskerville case files",
      status: "Archived",
      priority: "P3",
      context: "Work",
      completedIn: -14,
      tags: ["Work"],
    },
  ];

  console.log(`Inserting ${samples.length} tasks...`);
  for (const s of samples) {
    const [created] = await db
      .insert(tasks)
      .values({
        title: s.title,
        notes: s.notes ?? null,
        status: s.status,
        context: s.context ?? null,
        priority: s.priority,
        dueAt: s.dueIn !== undefined ? iso(s.dueIn) : null,
        completedAt: s.completedIn !== undefined ? iso(s.completedIn) : null,
        isFocus: s.isFocus ?? false,
        orderIndex: nextIdx(),
        createdBy: "web_ui",
      })
      .returning();

    if (s.tags?.length) {
      await db
        .insert(taskTags)
        .values(s.tags.map((name) => ({ taskId: created.id, tagId: tag[name] })));
    }

    if (s.subtasks?.length) {
      let subIdx: string | null = null;
      for (const st of s.subtasks) {
        subIdx = generateKeyBetween(subIdx, null);
        await db.insert(subtasks).values({
          taskId: created.id,
          title: st.title,
          done: st.done ?? false,
          orderIndex: subIdx,
          createdBy: "web_ui",
        });
      }
    }
  }

  console.log("Sample data seeded.");
}

const isMainModule =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const db = createDb();
  seedSampleData(db)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Sample seed failed:", err);
      process.exit(1);
    });
}
