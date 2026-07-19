# TV Task Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three read-only, auto-refreshing task views (`/tv/today`, `/tv/kanban`, `/tv/week`) for a TV display, served from the existing Next.js app.

**Architecture:** New `app/tv/` route group (sibling of `(shell)`, so no sidebar chrome). Pages are React Server Components calling the existing `lib/api` layer directly against in-process SQLite. One client component polls `router.refresh()` every 60s. Display-only components in `components/tv/` reuse semantic OKLCH tokens and the canonical `Task` type.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, date-fns 4, Drizzle ORM (better-sqlite3), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-tv-task-viewer-design.md`

## Global Constraints

- TypeScript strict mode; lint + typecheck must pass before every commit (Husky enforces).
- Colors via semantic OKLCH CSS variables only — Tailwind 4 syntax `text-[var(--status-active)]`, never bare `[--var]`, never hardcoded color classes.
- Icons from `lucide-react` only.
- Canonical types from `@/types` (`apps/web/src/types/index.ts`) — never inline task types.
- `cn()` helper from `@/lib/utils` for conditional classes.
- No new dependencies.
- All `/tv/*` pages are display-only: no click handlers, no forms, no TanStack Query.
- Run all commands from `apps/web/` unless stated otherwise (Node >= 20, `nvm use` first).

---

### Task 1: `getUpcomingTasks` query

**Files:**
- Modify: `apps/web/src/lib/api/tasks.ts` (imports at top; new function after `getFocusTasks`, ~line 399)
- Test: `apps/web/src/__tests__/api/tasks.test.ts` (append new describe block before final closing `});`)

**Interfaces:**
- Consumes: existing `getDb()`, `mapTask()`, drizzle operators, `tasks`/`subtasks` schema — all already in `tasks.ts`.
- Produces: `getUpcomingTasks(days?: number): Promise<Task[]>` — tasks with `dueAt` in `(end of today, end of today+days]`, excluding Done/Archived and null `dueAt`, ordered by `dueAt` ascending. Task 6 (`/tv/week`) imports this.

- [ ] **Step 1: Write the failing test**

Append inside the top-level `describe` in `apps/web/src/__tests__/api/tasks.test.ts` (the file's existing setup — `createTestDb`, `vi.mock` of the db client, `beforeEach` table wipe — already applies to new blocks):

```ts
  // ── getUpcomingTasks ────────────────────────────────────────────

  describe("getUpcomingTasks", () => {
    it("returns tasks due in the next 7 days, excluding today, day 8, Done, Archived, and no-due-date", async () => {
      const { createTask, getUpcomingTasks } = await import(
        "../../lib/api/tasks"
      );

      const daysFromNow = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return d;
      };

      await createTask({ title: "Due today", status: "Active", dueAt: new Date() });
      await createTask({ title: "Tomorrow", status: "Active", dueAt: daysFromNow(1) });
      await createTask({ title: "Day 7", status: "Active", dueAt: daysFromNow(7) });
      await createTask({ title: "Day 8", status: "Active", dueAt: daysFromNow(8) });
      await createTask({ title: "Done tomorrow", status: "Done", dueAt: daysFromNow(1) });
      await createTask({ title: "Archived tomorrow", status: "Archived", dueAt: daysFromNow(1) });
      await createTask({ title: "No due date", status: "Active" });

      const upcoming = await getUpcomingTasks();

      expect(upcoming.map((t) => t.title)).toEqual(["Tomorrow", "Day 7"]);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @baker-street/web test`
Expected: FAIL — `getUpcomingTasks` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/api/tasks.ts`, change the date-fns import line:

```ts
import { startOfDay, endOfDay, addDays } from "date-fns";
```

Add after `getFocusTasks` (keep it in the `// ── Dashboard queries` section):

```ts
export async function getUpcomingTasks(days = 7): Promise<Task[]> {
  const db = getDb();
  const todayEnd = endOfDay(new Date()).toISOString();
  const windowEnd = endOfDay(addDays(new Date(), days)).toISOString();
  const rows = await db.query.tasks.findMany({
    where: and(
      gte(tasks.dueAt, todayEnd),
      lt(tasks.dueAt, windowEnd),
      ne(tasks.status, "Done"),
      ne(tasks.status, "Archived")
    ),
    with: {
      subtasks: { orderBy: asc(subtasks.orderIndex) },
      taskTags: { with: { tag: true } },
    },
    orderBy: asc(tasks.dueAt),
  });
  return rows.map(mapTask);
}
```

Window boundaries: `gte` end-of-today makes it disjoint with `getDueTodayTasks` (which uses `lt` end-of-today); null `dueAt` rows fail the `gte` comparison in SQLite and drop out.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @baker-street/web test`
Expected: PASS (all existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/tasks.ts apps/web/src/__tests__/api/tasks.test.ts
git commit -m "feat(web): add getUpcomingTasks dashboard query"
```

---

### Task 2: TV presentation components

**Files:**
- Create: `apps/web/src/components/tv/TvSection.tsx`
- Create: `apps/web/src/components/tv/TvTaskRow.tsx`
- Create: `apps/web/src/components/tv/TvKanbanColumn.tsx`

**Interfaces:**
- Consumes: `Task`, `Tag` from `@/types`; `cn` from `@/lib/utils`; `format` from `date-fns`; `Star` from `lucide-react`.
- Produces (used by Tasks 4–6):
  - `TvSection({ title, count, accentVar, emptyMessage, children }: { title: string; count: number; accentVar: string; emptyMessage: string; children: React.ReactNode })`
  - `TvTaskRow({ task, showDue = true }: { task: Task; showDue?: boolean })`
  - `TvKanbanColumn({ title, accentVar, tasks }: { title: string; accentVar: string; tasks: Task[] })`

No component test infra exists in this repo (tests are API-level only) — these are verified by typecheck/lint here and visual smoke test in Task 7.

- [ ] **Step 1: Create `TvSection.tsx`**

```tsx
export function TvSection({
  title,
  count,
  accentVar,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  accentVar: string;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden">
      <header className="mb-4 flex items-baseline gap-3 border-b border-border pb-3">
        <h2
          className="text-2xl font-semibold uppercase tracking-widest"
          style={{ color: accentVar }}
        >
          {title}
        </h2>
        <span className="text-2xl text-muted-foreground">{count}</span>
      </header>
      {count === 0 ? (
        <p className="text-2xl text-muted-foreground/60">{emptyMessage}</p>
      ) : (
        <div className="flex min-h-0 flex-col divide-y divide-border/50 overflow-hidden">
          {children}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Create `TvTaskRow.tsx`**

```tsx
import { Star } from "lucide-react";
import { format } from "date-fns";
import type { Task } from "@/types";

const PRIORITY_VARS: Record<Task["priority"], string> = {
  P0: "var(--priority-p0)",
  P1: "var(--priority-p1)",
  P2: "var(--priority-p2)",
  P3: "var(--priority-p3)",
};

export function TvTaskRow({
  task,
  showDue = true,
}: {
  task: Task;
  showDue?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_VARS[task.priority] }}
        aria-label={task.priority}
      />
      <span className="truncate text-3xl">{task.title}</span>
      {task.isFocus && (
        <Star className="h-6 w-6 shrink-0 fill-[var(--focus-star)] text-[var(--focus-star)]" />
      )}
      {showDue && task.dueAt && (
        <span className="ml-auto shrink-0 pl-4 text-2xl text-muted-foreground">
          {format(task.dueAt, "EEE MMM d")}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `TvKanbanColumn.tsx`**

```tsx
import type { Task } from "@/types";
import { TvTaskRow } from "./TvTaskRow";

export function TvKanbanColumn({
  title,
  accentVar,
  tasks,
}: {
  title: string;
  accentVar: string;
  tasks: Task[];
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-card p-6">
      <header className="mb-4 flex items-baseline gap-3 border-b border-border pb-3">
        <h2
          className="text-2xl font-semibold uppercase tracking-widest"
          style={{ color: accentVar }}
        >
          {title}
        </h2>
        <span className="text-2xl text-muted-foreground">{tasks.length}</span>
      </header>
      {tasks.length === 0 ? (
        <p className="text-2xl text-muted-foreground/60">Empty</p>
      ) : (
        <div className="flex min-h-0 flex-col divide-y divide-border/50 overflow-hidden">
          {tasks.map((task) => (
            <TvTaskRow key={task.id} task={task} showDue={false} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Verify typecheck and lint**

Run: `pnpm --filter @baker-street/web typecheck && pnpm --filter @baker-street/web lint`
Expected: both PASS (unused-component lint warnings should not occur; if `next lint` flags the files as unused that is not a rule in this config — any error is must-fix).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tv/
git commit -m "feat(web): add TV display components (TvSection, TvTaskRow, TvKanbanColumn)"
```

---

### Task 3: TV layout, auto-refresh, footer, error boundary

**Files:**
- Create: `apps/web/src/app/tv/layout.tsx`
- Create: `apps/web/src/app/tv/error.tsx`
- Create: `apps/web/src/components/tv/TvAutoRefresh.tsx`
- Create: `apps/web/src/components/tv/TvFooter.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the `/tv` segment layout wrapping Tasks 4–6's pages. `TvAutoRefresh({ intervalMs?: number })` (default 60_000) and `TvFooter({ renderedAt }: { renderedAt: string })` are internal to the layout.

- [ ] **Step 1: Create `TvAutoRefresh.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TvAutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
```

- [ ] **Step 2: Create `TvFooter.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

export function TvFooter({ renderedAt }: { renderedAt: string }) {
  // null until mounted — avoids a server/client hydration mismatch on time text
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <footer className="pt-6" />;

  const updatedSecs = Math.max(
    0,
    Math.round((now.getTime() - new Date(renderedAt).getTime()) / 1000)
  );

  return (
    <footer className="flex items-center justify-between pt-6 text-xl text-muted-foreground">
      <span>Updated {updatedSecs}s ago</span>
      <span>{format(now, "EEE MMM d · h:mm a")}</span>
    </footer>
  );
}
```

- [ ] **Step 3: Create `layout.tsx`**

```tsx
import { TvAutoRefresh } from "@/components/tv/TvAutoRefresh";
import { TvFooter } from "@/components/tv/TvFooter";

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen cursor-none flex-col overflow-hidden bg-background px-12 py-10 text-foreground">
      <TvAutoRefresh />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      <TvFooter renderedAt={new Date().toISOString()} />
    </div>
  );
}
```

`renderedAt` is stamped per server render; the pages' `force-dynamic` (Tasks 4–6) makes the whole segment re-render on every `router.refresh()`, so the footer's "updated" counter resets each poll.

- [ ] **Step 4: Create `error.tsx`**

```tsx
"use client";

import { useEffect } from "react";

export default function TvError({ reset }: { error: Error; reset: () => void }) {
  // Auto-retry: error boundaries don't reset on router.refresh() alone
  useEffect(() => {
    const id = setInterval(() => reset(), 60_000);
    return () => clearInterval(id);
  }, [reset]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p className="text-4xl text-muted-foreground">Tasks unavailable</p>
      <p className="text-2xl text-muted-foreground/60">Retrying automatically…</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck and lint**

Run: `pnpm --filter @baker-street/web typecheck && pnpm --filter @baker-street/web lint`
Expected: both PASS. Note: `error.tsx` must destructure only `reset` but declare `error` in the props type (Next.js passes both); if lint complains about the unused `error` prop pattern, destructure it as `{ reset }` exactly as shown — the prop type annotation alone does not trigger no-unused-vars.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/tv/ apps/web/src/components/tv/TvAutoRefresh.tsx apps/web/src/components/tv/TvFooter.tsx
git commit -m "feat(web): add /tv layout with 60s auto-refresh, footer clock, error boundary"
```

---

### Task 4: `/tv/today` page

**Files:**
- Create: `apps/web/src/app/tv/today/page.tsx`

**Interfaces:**
- Consumes: `getOverdueTasks()`, `getDueTodayTasks()`, `getFocusTasks()` from `@/lib/api/tasks` (existing); `TvSection`, `TvTaskRow` from Task 2.
- Produces: route `GET /tv/today`.

- [ ] **Step 1: Create `page.tsx`**

```tsx
import {
  getOverdueTasks,
  getDueTodayTasks,
  getFocusTasks,
} from "@/lib/api/tasks";
import { TvSection } from "@/components/tv/TvSection";
import { TvTaskRow } from "@/components/tv/TvTaskRow";

export const dynamic = "force-dynamic";

export default async function TvTodayPage() {
  const [overdue, dueToday, focus] = await Promise.all([
    getOverdueTasks(),
    getDueTodayTasks(),
    getFocusTasks(),
  ]);

  return (
    <div className="grid h-full grid-cols-3 gap-12">
      <TvSection
        title="Overdue"
        count={overdue.length}
        accentVar="var(--date-overdue)"
        emptyMessage="All caught up"
      >
        {overdue.map((task) => (
          <TvTaskRow key={task.id} task={task} />
        ))}
      </TvSection>
      <TvSection
        title="Due Today"
        count={dueToday.length}
        accentVar="var(--date-today)"
        emptyMessage="Nothing due today"
      >
        {dueToday.map((task) => (
          <TvTaskRow key={task.id} task={task} showDue={false} />
        ))}
      </TvSection>
      <TvSection
        title="Focus"
        count={focus.length}
        accentVar="var(--focus-star)"
        emptyMessage="No focus tasks"
      >
        {focus.map((task) => (
          <TvTaskRow key={task.id} task={task} />
        ))}
      </TvSection>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run (repo root): `pnpm dev` (leave running), then in another shell:
`curl -s http://localhost:3000/tv/today | grep -o "Due Today"`
Expected: `Due Today`

- [ ] **Step 3: Typecheck, lint, commit**

Run: `pnpm --filter @baker-street/web typecheck && pnpm --filter @baker-street/web lint`
Expected: PASS.

```bash
git add apps/web/src/app/tv/today/
git commit -m "feat(web): add /tv/today view (overdue, due today, focus)"
```

---

### Task 5: `/tv/kanban` page

**Files:**
- Create: `apps/web/src/app/tv/kanban/page.tsx`

**Interfaces:**
- Consumes: `getTasks({ status })` from `@/lib/api/tasks` (existing; `status?: TaskStatus[]`); `TvKanbanColumn` from Task 2.
- Produces: route `GET /tv/kanban`.

- [ ] **Step 1: Create `page.tsx`**

```tsx
import { getTasks } from "@/lib/api/tasks";
import { TvKanbanColumn } from "@/components/tv/TvKanbanColumn";
import type { TaskStatus } from "@/types";

export const dynamic = "force-dynamic";

const COLUMNS: { status: TaskStatus; accentVar: string }[] = [
  { status: "Inbox", accentVar: "var(--status-inbox)" },
  { status: "Active", accentVar: "var(--status-active)" },
  { status: "Someday", accentVar: "var(--status-someday)" },
];

export default async function TvKanbanPage() {
  const tasks = await getTasks({
    status: COLUMNS.map((c) => c.status),
  });

  return (
    <div className="grid h-full grid-cols-3 gap-12">
      {COLUMNS.map(({ status, accentVar }) => (
        <TvKanbanColumn
          key={status}
          title={status}
          accentVar={accentVar}
          tasks={tasks.filter((t) => t.status === status)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

With `pnpm dev` running:
`curl -s http://localhost:3000/tv/kanban | grep -o "Someday" | head -1`
Expected: `Someday`

- [ ] **Step 3: Typecheck, lint, commit**

Run: `pnpm --filter @baker-street/web typecheck && pnpm --filter @baker-street/web lint`
Expected: PASS.

```bash
git add apps/web/src/app/tv/kanban/
git commit -m "feat(web): add /tv/kanban view (Inbox/Active/Someday columns)"
```

---

### Task 6: `/tv/week` page

**Files:**
- Create: `apps/web/src/app/tv/week/page.tsx`

**Interfaces:**
- Consumes: `getUpcomingTasks()` from Task 1; `TvSection`, `TvTaskRow` from Task 2.
- Produces: route `GET /tv/week`.

- [ ] **Step 1: Create `page.tsx`**

Only days that have tasks get a section (empty days waste TV space); a global empty state covers the no-tasks week. `getUpcomingTasks` never returns null `dueAt`, but TypeScript can't know — the `if (!task.dueAt) continue;` guard is the narrowing, not defensive logic.

```tsx
import { format } from "date-fns";
import { getUpcomingTasks } from "@/lib/api/tasks";
import { TvSection } from "@/components/tv/TvSection";
import { TvTaskRow } from "@/components/tv/TvTaskRow";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";

export default async function TvWeekPage() {
  const tasks = await getUpcomingTasks();

  const byDay = new Map<string, { label: string; tasks: Task[] }>();
  for (const task of tasks) {
    if (!task.dueAt) continue;
    const key = format(task.dueAt, "yyyy-MM-dd");
    if (!byDay.has(key)) {
      byDay.set(key, { label: format(task.dueAt, "EEEE · MMM d"), tasks: [] });
    }
    byDay.get(key)!.tasks.push(task);
  }

  if (byDay.size === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-4xl text-muted-foreground">
          Nothing due in the next 7 days
        </p>
      </div>
    );
  }

  return (
    <div className="grid h-full auto-rows-min grid-cols-2 content-start gap-x-12 gap-y-10 overflow-hidden">
      {[...byDay.entries()].map(([key, day]) => (
        <TvSection
          key={key}
          title={day.label}
          count={day.tasks.length}
          accentVar="var(--date-today)"
          emptyMessage=""
        >
          {day.tasks.map((task) => (
            <TvTaskRow key={task.id} task={task} showDue={false} />
          ))}
        </TvSection>
      ))}
    </div>
  );
}
```

Map iteration preserves insertion order and `getUpcomingTasks` sorts by `dueAt` ascending, so days render chronologically.

- [ ] **Step 2: Verify it renders**

With `pnpm dev` running:
`curl -s http://localhost:3000/tv/week | grep -oE "Nothing due in the next 7 days|·" | head -1`
Expected: either `Nothing due in the next 7 days` (empty DB) or `·` (day headers present).

- [ ] **Step 3: Typecheck, lint, commit**

Run: `pnpm --filter @baker-street/web typecheck && pnpm --filter @baker-street/web lint`
Expected: PASS.

```bash
git add apps/web/src/app/tv/week/
git commit -m "feat(web): add /tv/week view (next 7 days grouped by day)"
```

---

### Task 7: Full verification and visual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Full quality gates from repo root**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all PASS across all packages.

- [ ] **Step 2: Visual smoke test**

With `pnpm dev` running, open in a browser (1920×1080 or larger window):
- `http://localhost:3000/tv/today` — three columns, large type, no sidebar, footer shows clock and "Updated Ns ago"
- `http://localhost:3000/tv/kanban` — Inbox/Active/Someday columns
- `http://localhost:3000/tv/week` — day-grouped sections or the empty state

Then confirm auto-refresh: create a task due today via the main UI (`http://localhost:3000`), watch `/tv/today` pick it up within ~60s without a page reload (footer counter resets).

- [ ] **Step 3: Production build check**

Run: `pnpm build`
Expected: build succeeds; `/tv/*` routes listed as dynamic (ƒ) in the Next.js route summary.

---

## Out of Scope

- The rotating dashboard host app (not designed yet — it just points at these URLs)
- Auth on `/tv/*` (matches app-wide no-auth posture, accepted in spec)
- Kanban swimlanes, tags on TV rows beyond what's shown, pagination/scrolling of overflow
- New API routes, Docker/k8s changes (routes ship in the existing image)
