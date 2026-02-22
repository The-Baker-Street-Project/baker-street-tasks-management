# UI Fundamentals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all broken data flows, wire up missing PRD features, and add dark mode toggle + loading states across the Baker Street Tasks web app.

**Architecture:** Three parallel teams working in isolated git worktrees. Team 1 fixes the data pipeline (context/tag/view filtering). Team 2 wires up task interactions (checkboxes, add-tag, subtask warnings). Team 3 adds theme support and loading skeletons. Team 1 merges first (other teams consume its API changes).

**Tech Stack:** Next.js 15, React 19, Tailwind 4, shadcn/ui, Drizzle ORM, nuqs, next-themes

---

## Team 1: Data Flow & Filtering

**Branch:** `feat/data-flow-filtering`
**Merge order:** First (other teams depend on API params)
**Build command:** `cd {WORKTREE_PATH} && pnpm install && pnpm -r build`

### Task 1.1: Add context and tag params to tasks API

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/lib/api/tasks.ts`

**Step 1: Add context and tagId to GetTasksParams interface**

In `{WORKTREE_PATH}/apps/web/src/lib/api/tasks.ts`, find the `GetTasksParams` interface and replace it:

```typescript
export interface GetTasksParams {
  status?: TaskStatus[];
  view?: string;
  tagId?: string;
  context?: Context | null;
  sort?: "due_date" | "priority" | "created" | "order";
}
```

**Step 2: Add context filter condition to getTasks**

In the `getTasks` function, after the view status mapping block (after line ~109), add:

```typescript
  if (params?.context) {
    conditions.push(eq(tasks.context, params.context));
  }
```

**Step 3: Add tagId filter condition to getTasks**

After the context filter, add a join-based tag filter. This requires importing `inArray` from drizzle-orm and using a subquery:

At the top of the file, add `inArray` to the drizzle-orm import:
```typescript
import { eq, and, lt, gte, ne, or, ilike, asc, desc, inArray } from "drizzle-orm";
```

Then after the context filter condition:
```typescript
  if (params?.tagId) {
    // Subquery: find task IDs that have this tag
    const taggedTaskIds = await db
      .select({ taskId: taskTags.taskId })
      .from(taskTags)
      .where(eq(taskTags.tagId, params.tagId));
    const ids = taggedTaskIds.map((r) => r.taskId);
    if (ids.length === 0) return [];
    conditions.push(inArray(tasks.id, ids));
  }
```

**Step 4: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 5: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/lib/api/tasks.ts && git commit -m "feat: add context and tag filtering to tasks API"
```

---

### Task 1.2: Add context param to captures API

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/lib/api/captures.ts`

**Step 1: Add context to GetCapturesParams**

In `{WORKTREE_PATH}/apps/web/src/lib/api/captures.ts`, replace the `GetCapturesParams` interface:

```typescript
export interface GetCapturesParams {
  status?: CaptureStatus[];
  pinned?: boolean;
  tab?: "recent" | "pinned" | "reviewed" | "archived";
  context?: Context | null;
}
```

**Step 2: Add context filter to getCaptures**

In the `getCaptures` function, after the tab mapping block (after line ~91), add:

```typescript
  if (params?.context) {
    conditions.push(eq(captures.context, params.context));
  }
```

**Step 3: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 4: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/lib/api/captures.ts && git commit -m "feat: add context filtering to captures API"
```

---

### Task 1.3: Wire context toggle to URL state

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/components/shell/context-toggle.tsx`

**Step 1: Replace the entire file**

Replace `{WORKTREE_PATH}/apps/web/src/components/shell/context-toggle.tsx` with:

```typescript
"use client";

import { useQueryState } from "nuqs";
import { Home, Briefcase, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ContextOption = "All" | "Home" | "Work";

const OPTIONS: { value: ContextOption; label: string; icon: React.ElementType }[] = [
  { value: "All", label: "All", icon: Globe },
  { value: "Home", label: "Home", icon: Home },
  { value: "Work", label: "Work", icon: Briefcase },
];

export function ContextToggle() {
  const [context, setContext] = useQueryState("context", {
    defaultValue: "All",
  });

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="sm"
          className={cn(
            "flex-1 gap-1.5 text-xs",
            context === option.value &&
              "bg-background text-foreground shadow-sm hover:bg-background"
          )}
          onClick={() => setContext(option.value === "All" ? null : option.value)}
        >
          <option.icon className="h-3.5 w-3.5" />
          {option.label}
        </Button>
      ))}
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 3: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/components/shell/context-toggle.tsx && git commit -m "feat: wire context toggle to URL query state via nuqs"
```

---

### Task 1.4: Wire tasks page to read context and tag from URL

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/app/(shell)/tasks/tasks-page-client.tsx`

**Step 1: Replace the entire file**

Replace `{WORKTREE_PATH}/apps/web/src/app/(shell)/tasks/tasks-page-client.tsx` with:

```typescript
"use client";

import { useState, useCallback, useTransition } from "react";
import { useQueryState } from "nuqs";
import { TaskSidebar } from "@/components/tasks/TaskSidebar";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { TaskCreateDialog } from "@/components/tasks/TaskCreateDialog";
import { getTasks, getTask } from "@/lib/api/tasks";
import type { Task, SavedView, Tag, Context } from "@/types";

interface TasksPageClientProps {
  initialTasks: Task[];
  savedViews: SavedView[];
  tags: Tag[];
}

export function TasksPageClient({
  initialTasks,
  savedViews,
  tags,
}: TasksPageClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useQueryState("taskId");
  const [selectedView] = useQueryState("view", { defaultValue: "all" });
  const [selectedTag] = useQueryState("tag");
  const [contextParam] = useQueryState("context");
  const [isPending, startTransition] = useTransition();

  const viewTitle = (() => {
    if (selectedTag) {
      const tag = tags.find((t) => t.id === selectedTag);
      return tag ? `Tag: ${tag.name}` : "Tagged Tasks";
    }
    const view = savedViews.find((v) => v.id === selectedView);
    if (view) return view.name;
    const nameMap: Record<string, string> = {
      all: "All Tasks",
      inbox: "Inbox",
      active: "Active",
    };
    return nameMap[selectedView] ?? "All Tasks";
  })();

  const refreshTasks = useCallback(() => {
    startTransition(async () => {
      try {
        const context = contextParam && contextParam !== "All"
          ? (contextParam as Context)
          : undefined;
        const updated = await getTasks({
          view: selectedView ?? undefined,
          tagId: selectedTag ?? undefined,
          context: context ?? undefined,
        });
        setTasks(updated);
      } catch {
        // silently fail
      }
    });
  }, [selectedView, selectedTag, contextParam]);

  const handleTaskSelect = useCallback(
    async (taskId: string | null) => {
      if (!taskId) {
        setSelectedTask(null);
        return;
      }
      try {
        const task = await getTask(taskId);
        setSelectedTask(task);
      } catch {
        setSelectedTask(null);
      }
    },
    []
  );

  // When selectedTaskId changes via URL, fetch the task detail
  const currentTask =
    selectedTaskId && selectedTask?.id === selectedTaskId
      ? selectedTask
      : null;

  if (selectedTaskId && !currentTask && !isPending) {
    handleTaskSelect(selectedTaskId);
  }

  // Re-fetch when filters change
  // Use a key based on filter params to trigger re-fetch
  const filterKey = `${selectedView}-${selectedTag}-${contextParam}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    refreshTasks();
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <TaskSidebar savedViews={savedViews} tags={tags} />
      </div>

      {/* Middle list */}
      <div className="flex-1 min-w-0">
        <TaskList
          tasks={tasks}
          title={viewTitle}
          isLoading={isPending}
          onCreateClick={() => setShowCreateDialog(true)}
        />
      </div>

      {/* Right detail */}
      {currentTask && (
        <div className="hidden md:block">
          <TaskDetail
            task={currentTask}
            allTags={tags}
            onClose={() => {
              setSelectedTaskId(null);
              setSelectedTask(null);
            }}
            onRefresh={() => {
              refreshTasks();
              if (selectedTaskId) {
                handleTaskSelect(selectedTaskId);
              }
            }}
          />
        </div>
      )}

      <TaskCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={refreshTasks}
      />
    </div>
  );
}
```

Note: This adds an `allTags` prop to `TaskDetail` — Team 2 will consume this in their add-tag feature. For now the prop is passed but `TaskDetail` doesn't use it yet. Add a temporary `allTags?: Tag[]` to `TaskDetailProps` interface so it compiles:

In `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetail.tsx`, add `allTags` to the interface:

```typescript
interface TaskDetailProps {
  task: Task;
  allTags?: Tag[];
  onClose: () => void;
  onRefresh: () => void;
}
```

And update the destructuring:
```typescript
export function TaskDetail({ task, allTags, onClose, onRefresh }: TaskDetailProps) {
```

Import `Tag` type if not already imported:
```typescript
import type { Task, TaskStatus, Priority, Context, Tag } from "@/types";
```

**Step 2: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 3: Commit**

```bash
cd {WORKTREE_PATH} && git add -A && git commit -m "feat: wire tasks page to context and tag URL params"
```

---

### Task 1.5: Wire captures page to read context from URL

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/app/(shell)/captures/captures-page-client.tsx`

**Step 1: Add context param reading**

In `{WORKTREE_PATH}/apps/web/src/app/(shell)/captures/captures-page-client.tsx`:

Add a new query state after the existing ones:
```typescript
  const [contextParam] = useQueryState("context");
```

Update `refreshCaptures` to pass context:
```typescript
  const refreshCaptures = useCallback(() => {
    startTransition(async () => {
      try {
        const context = contextParam && contextParam !== "All"
          ? (contextParam as Context)
          : undefined;
        const updated = await getCaptures({
          tab: (activeTab as CaptureTab) ?? "recent",
          context: context ?? undefined,
        });
        setCaptures(updated);
      } catch {
        // silently fail
      }
    });
  }, [activeTab, contextParam]);
```

Add the `Context` type import:
```typescript
import type { Capture, Context } from "@/types";
```

Add filter change detection (after the existing `refreshCaptures`):
```typescript
  const filterKey = `${activeTab}-${contextParam}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    refreshCaptures();
  }
```

**Step 2: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 3: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/app/\(shell\)/captures/captures-page-client.tsx && git commit -m "feat: wire captures page to context URL param"
```

---

### Task 1.6: Handle custom saved view filterDefinition

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/lib/api/tasks.ts`

**Step 1: Add filterDefinition parsing to getTasks**

In the `getTasks` function in `{WORKTREE_PATH}/apps/web/src/lib/api/tasks.ts`, replace the view mapping block:

Find this block:
```typescript
  // Map system view IDs to status filters
  if (params?.view && params.view !== "all") {
    const viewStatusMap: Record<string, TaskStatus> = {
      inbox: "Inbox",
      active: "Active",
      someday: "Someday",
      done: "Done",
      archived: "Archived",
    };
    const mappedStatus = viewStatusMap[params.view];
    if (mappedStatus) {
      conditions.push(eq(tasks.status, mappedStatus));
    }
  }
```

Replace with:
```typescript
  // Map system view IDs to status filters, or parse custom view filterDefinition
  if (params?.view && params.view !== "all") {
    const viewStatusMap: Record<string, TaskStatus> = {
      inbox: "Inbox",
      active: "Active",
      someday: "Someday",
      done: "Done",
      archived: "Archived",
    };
    const mappedStatus = viewStatusMap[params.view];
    if (mappedStatus) {
      conditions.push(eq(tasks.status, mappedStatus));
    } else {
      // Try loading a custom saved view by ID
      const { savedViews } = await import("@baker-street/db/schema");
      const view = await db.query.savedViews.findFirst({
        where: eq(savedViews.id, params.view),
      });
      if (view?.filterDefinition) {
        const filter = view.filterDefinition as Record<string, unknown>;
        if (filter.status && typeof filter.status === "string") {
          conditions.push(eq(tasks.status, filter.status as TaskStatus));
        }
        if (filter.context && typeof filter.context === "string") {
          conditions.push(eq(tasks.context, filter.context));
        }
        if (filter.priority && typeof filter.priority === "string") {
          conditions.push(eq(tasks.priority, filter.priority));
        }
      }
    }
  }
```

Also import `savedViews` at the top (add to existing schema import):
```typescript
import {
  tasks,
  subtasks,
  taskTags,
  tags,
  savedViews,
} from "@baker-street/db/schema";
```

Then remove the dynamic import line inside the function (since we now import at top level).

**Step 2: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 3: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/lib/api/tasks.ts && git commit -m "feat: parse custom saved view filterDefinition for task queries"
```

---

## Team 2: Task Actions & Interactions

**Branch:** `feat/task-actions`
**Merge order:** Second (depends on Team 1's allTags prop)
**Build command:** `cd {WORKTREE_PATH} && pnpm install && pnpm -r build`

### Task 2.1: Wire complete/reopen checkboxes in TaskList

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskList.tsx`

**Step 1: Add complete/reopen imports and handler**

In `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskList.tsx`:

Add to imports:
```typescript
import { useTransition } from "react";
import { completeTask, reopenTask } from "@/lib/api/tasks";
```

Update the component signature to accept an `onRefresh` prop:
```typescript
interface TaskListProps {
  tasks: Task[];
  title: string;
  isLoading?: boolean;
  onCreateClick: () => void;
  onRefresh?: () => void;
}

export function TaskList({
  tasks,
  title,
  isLoading = false,
  onCreateClick,
  onRefresh,
}: TaskListProps) {
```

Add a transition and handler inside the component, after the existing `handleTaskClick`:
```typescript
  const [isToggling, startToggle] = useTransition();

  const handleToggleComplete = useCallback(
    (taskId: string, done: boolean) => {
      startToggle(async () => {
        if (done) {
          await completeTask(taskId);
        } else {
          await reopenTask(taskId);
        }
        onRefresh?.();
      });
    },
    [onRefresh]
  );
```

**Step 2: Pass showCheckbox and onToggleComplete to TaskRow**

In the virtual list render, update the `SharedTaskRow` usage:

Find:
```typescript
                    <SharedTaskRow task={task} />
```

Replace with:
```typescript
                    <SharedTaskRow
                      task={task}
                      showCheckbox
                      onToggleComplete={handleToggleComplete}
                    />
```

**Step 3: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 4: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/components/tasks/TaskList.tsx && git commit -m "feat: wire complete/reopen checkboxes in task list"
```

---

### Task 2.2: Add onRefresh to TaskList in tasks-page-client

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/app/(shell)/tasks/tasks-page-client.tsx`

**Step 1: Pass onRefresh to TaskList**

In `{WORKTREE_PATH}/apps/web/src/app/(shell)/tasks/tasks-page-client.tsx`, find the `<TaskList` component and add the `onRefresh` prop:

Find:
```typescript
        <TaskList
          tasks={tasks}
          title={viewTitle}
          isLoading={isPending}
          onCreateClick={() => setShowCreateDialog(true)}
        />
```

Replace with:
```typescript
        <TaskList
          tasks={tasks}
          title={viewTitle}
          isLoading={isPending}
          onCreateClick={() => setShowCreateDialog(true)}
          onRefresh={refreshTasks}
        />
```

**Step 2: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 3: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/app/\(shell\)/tasks/tasks-page-client.tsx && git commit -m "feat: pass onRefresh to TaskList for checkbox updates"
```

---

### Task 2.3: Wire complete checkboxes in dashboard blocks

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/app/(shell)/page.tsx`
- Modify: `{WORKTREE_PATH}/apps/web/src/components/dashboard/OverdueBlock.tsx`
- Modify: `{WORKTREE_PATH}/apps/web/src/components/dashboard/DueTodayBlock.tsx`
- Modify: `{WORKTREE_PATH}/apps/web/src/components/dashboard/NextUpBlock.tsx`
- Modify: `{WORKTREE_PATH}/apps/web/src/components/dashboard/HighPriorityBlock.tsx`
- Modify: `{WORKTREE_PATH}/apps/web/src/components/dashboard/InboxBlock.tsx`
- Modify: `{WORKTREE_PATH}/apps/web/src/components/dashboard/FocusBlock.tsx`

**Step 1: Convert dashboard page to use a client wrapper**

Create `{WORKTREE_PATH}/apps/web/src/app/(shell)/dashboard-client.tsx`:

```typescript
"use client";

import { useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { OverdueBlock } from "@/components/dashboard/OverdueBlock";
import { DueTodayBlock } from "@/components/dashboard/DueTodayBlock";
import { NextUpBlock } from "@/components/dashboard/NextUpBlock";
import { HighPriorityBlock } from "@/components/dashboard/HighPriorityBlock";
import { InboxBlock } from "@/components/dashboard/InboxBlock";
import { FocusBlock } from "@/components/dashboard/FocusBlock";
import { PinnedCapturesBlock } from "@/components/dashboard/PinnedCapturesBlock";
import { completeTask, reopenTask } from "@/lib/api/tasks";
import type { Task, Capture } from "@/types";

interface DashboardClientProps {
  overdue: Task[];
  dueToday: Task[];
  nextUp: Task[];
  highPriority: Task[];
  inbox: Task[];
  focus: Task[];
  pinnedCaptures: Capture[];
}

export function DashboardClient({
  overdue,
  dueToday,
  nextUp,
  highPriority,
  inbox,
  focus,
  pinnedCaptures,
}: DashboardClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleToggleComplete = useCallback(
    (taskId: string, done: boolean) => {
      startTransition(async () => {
        if (done) {
          await completeTask(taskId);
        } else {
          await reopenTask(taskId);
        }
        router.refresh();
      });
    },
    [router]
  );

  return (
    <DashboardGrid>
      <OverdueBlock tasks={overdue} onToggleComplete={handleToggleComplete} />
      <DueTodayBlock tasks={dueToday} onToggleComplete={handleToggleComplete} />
      <FocusBlock tasks={focus} onToggleComplete={handleToggleComplete} />
      <NextUpBlock tasks={nextUp} onToggleComplete={handleToggleComplete} />
      <HighPriorityBlock tasks={highPriority} onToggleComplete={handleToggleComplete} />
      <InboxBlock tasks={inbox} onToggleComplete={handleToggleComplete} />
      <PinnedCapturesBlock captures={pinnedCaptures} />
    </DashboardGrid>
  );
}
```

**Step 2: Update the dashboard page to use the client wrapper**

Replace `{WORKTREE_PATH}/apps/web/src/app/(shell)/page.tsx`:

```typescript
import { DashboardClient } from "./dashboard-client";
import {
  getOverdueTasks,
  getDueTodayTasks,
  getTasks,
  getHighPriorityTasks,
  getFocusTasks,
} from "@/lib/api/tasks";
import { getPinnedCaptures } from "@/lib/api/captures";

export default async function DashboardPage() {
  const [overdue, dueToday, nextUp, highPriority, inbox, focus, pinnedCaptures] =
    await Promise.all([
      getOverdueTasks(),
      getDueTodayTasks(),
      getTasks({ status: ["Active"], sort: "order" }).then((t) => t.slice(0, 5)),
      getHighPriorityTasks(),
      getTasks({ status: ["Inbox"] }).then((t) => t.slice(0, 5)),
      getFocusTasks(),
      getPinnedCaptures(),
    ]);

  return (
    <div className="h-full overflow-auto">
      <div className="border-b px-4 py-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your task overview at a glance
        </p>
      </div>

      <DashboardClient
        overdue={overdue}
        dueToday={dueToday}
        nextUp={nextUp}
        highPriority={highPriority}
        inbox={inbox}
        focus={focus}
        pinnedCaptures={pinnedCaptures}
      />
    </div>
  );
}
```

**Step 3: Update each dashboard block to accept onToggleComplete**

For each of these files, add the `onToggleComplete` prop and pass it to `TaskRow`:

`{WORKTREE_PATH}/apps/web/src/components/dashboard/OverdueBlock.tsx`:
```typescript
import { AlertTriangle } from "lucide-react";
import { DashboardBlock } from "./DashboardBlock";
import { TaskRow } from "@/components/shared/TaskRow";
import type { Task } from "@/types";

interface OverdueBlockProps {
  tasks: Task[];
  onToggleComplete?: (taskId: string, done: boolean) => void;
}

export function OverdueBlock({ tasks, onToggleComplete }: OverdueBlockProps) {
  return (
    <DashboardBlock
      title="Overdue"
      count={tasks.length}
      viewAllHref="/tasks?view=all&sort=due_date"
      icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
      emptyMessage="No overdue tasks"
    >
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          compact
          href={`/tasks?taskId=${task.id}`}
          showCheckbox={!!onToggleComplete}
          onToggleComplete={onToggleComplete}
        />
      ))}
    </DashboardBlock>
  );
}
```

Apply the same pattern to `DueTodayBlock.tsx`, `NextUpBlock.tsx`, `HighPriorityBlock.tsx`, `InboxBlock.tsx`, and `FocusBlock.tsx`. Each one:
1. Add `onToggleComplete?: (taskId: string, done: boolean) => void` to the props interface
2. Destructure `onToggleComplete` from props
3. Pass `showCheckbox={!!onToggleComplete}` and `onToggleComplete={onToggleComplete}` to each `TaskRow`

**Step 4: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 5: Commit**

```bash
cd {WORKTREE_PATH} && git add -A && git commit -m "feat: add complete/reopen checkboxes to dashboard blocks"
```

---

### Task 2.4: Add tag selector to TaskDetail TagsPanel

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetailPanels.tsx`
- Modify: `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetail.tsx`

**Step 1: Update TagsPanel to support adding tags**

In `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetailPanels.tsx`, replace the `TagsPanel` component:

```typescript
// ── Tags Panel ──────────────────────────────────────────────────

interface TagsPanelProps {
  tags: Tag[];
  allTags?: Tag[];
  onRemoveTag: (tagId: string) => void;
  onAddTag?: (tagId: string) => void;
}

export function TagsPanel({ tags, allTags = [], onRemoveTag, onAddTag }: TagsPanelProps) {
  const assignedIds = new Set(tags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !assignedIds.has(t.id));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Tags</h4>
      {tags.length === 0 && availableTags.length === 0 && (
        <p className="text-xs text-muted-foreground">No tags</p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pl-2 pr-1"
            >
              {tag.color && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
              <button
                type="button"
                onClick={() => onRemoveTag(tag.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {onAddTag && availableTags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add tag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableTags.map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                onClick={() => onAddTag(tag.id)}
                className="cursor-pointer gap-2"
              >
                {tag.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                {tag.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
```

Add the needed imports at the top of the file:
```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

**Step 2: Wire addTagToTask in TaskDetail**

In `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetail.tsx`:

Add `addTagToTask` to imports:
```typescript
import { updateTask, deleteTask, removeTagFromTask, addTagToTask } from "@/lib/api/tasks";
```

Add the handler after `handleRemoveTag`:
```typescript
  const handleAddTag = (tagId: string) => {
    startTransition(async () => {
      try {
        await addTagToTask(task.id, tagId);
        onRefresh();
      } catch {
        // silently fail
      }
    });
  };
```

Update the `TagsPanel` usage:
```typescript
          <TagsPanel
            tags={task.tags ?? []}
            allTags={allTags}
            onRemoveTag={handleRemoveTag}
            onAddTag={handleAddTag}
          />
```

**Step 3: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 4: Commit**

```bash
cd {WORKTREE_PATH} && git add -A && git commit -m "feat: add tag selector dropdown to task detail panel"
```

---

### Task 2.5: Add subtask completion warning

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetail.tsx`

**Step 1: Add subtask warning logic to handleStatusChange**

In `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetail.tsx`:

Add a state for the subtask warning dialog:
```typescript
  const [showSubtaskWarning, setShowSubtaskWarning] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
```

Replace `handleStatusChange`:
```typescript
  const handleStatusChange = (newStatus: TaskStatus) => {
    // Check for incomplete subtasks when marking as Done
    if (newStatus === "Done") {
      const incompleteSubtasks = (task.subtasks ?? []).filter((s) => !s.done);
      if (incompleteSubtasks.length > 0) {
        setPendingStatus(newStatus);
        setShowSubtaskWarning(true);
        return;
      }
    }
    setStatus(newStatus);
    saveField("status", newStatus);
  };

  const handleConfirmComplete = () => {
    setShowSubtaskWarning(false);
    if (pendingStatus) {
      setStatus(pendingStatus);
      // Auto-complete all subtasks, then set parent status
      startTransition(async () => {
        try {
          const incompleteSubtasks = (task.subtasks ?? []).filter((s) => !s.done);
          for (const subtask of incompleteSubtasks) {
            await toggleSubtask(subtask.id, true);
          }
          await updateTask(task.id, { status: pendingStatus });
          onRefresh();
        } catch {
          // silently fail
        }
      });
      setPendingStatus(null);
    }
  };
```

Add `toggleSubtask` to imports:
```typescript
import { updateTask, deleteTask, removeTagFromTask, addTagToTask, toggleSubtask } from "@/lib/api/tasks";
```

**Step 2: Add the warning dialog JSX**

After the existing delete Dialog, add:

```typescript
      {/* Subtask completion warning */}
      <Dialog open={showSubtaskWarning} onOpenChange={setShowSubtaskWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incomplete subtasks</DialogTitle>
            <DialogDescription>
              This task has {(task.subtasks ?? []).filter((s) => !s.done).length} incomplete
              subtask(s). Completing the task will also mark all subtasks as done.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSubtaskWarning(false);
                setPendingStatus(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmComplete} disabled={isPending}>
              Complete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

Place this just before the final closing `</div>` of the scrollable content area.

**Step 3: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 4: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/components/tasks/TaskDetail.tsx && git commit -m "feat: warn when completing task with incomplete subtasks"
```

---

### Task 2.6: Make search capture results clickable

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/app/(shell)/search/search-page-client.tsx`

**Step 1: Wrap capture results with links**

In `{WORKTREE_PATH}/apps/web/src/app/(shell)/search/search-page-client.tsx`:

Add `Link` import:
```typescript
import Link from "next/link";
```

Find the captures rendering section and wrap each `CaptureRow` in a Link:

```typescript
        {captures.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">
                Captures ({captures.length})
              </h2>
            </div>
            <div className="divide-y rounded-lg border">
              {captures.map((capture) => (
                <Link
                  key={capture.id}
                  href={`/captures?captureId=${capture.id}`}
                  className="block"
                >
                  <CaptureRow capture={capture} />
                </Link>
              ))}
            </div>
          </div>
        )}
```

**Step 2: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 3: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/app/\(shell\)/search/search-page-client.tsx && git commit -m "feat: make capture search results clickable"
```

---

## Team 3: Theme & Polish

**Branch:** `feat/theme-polish`
**Merge order:** Third (independent, no API dependencies)
**Build command:** `cd {WORKTREE_PATH} && pnpm install && pnpm -r build`

### Task 3.1: Install next-themes and configure ThemeProvider

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/package.json`
- Modify: `{WORKTREE_PATH}/apps/web/src/app/layout.tsx`

**Step 1: Install next-themes**

```bash
cd {WORKTREE_PATH}/apps/web && pnpm add next-themes
```

**Step 2: Wrap app in ThemeProvider**

Replace `{WORKTREE_PATH}/apps/web/src/app/layout.tsx`:

```typescript
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/lib/queries/providers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Baker Street Tasks",
  description: "AI-aware task management for humans and agents",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/icon-192.png" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>
            <QueryProvider>{children}</QueryProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Key change: Removed hardcoded `className="dark"` from `<html>`, let `next-themes` manage it.

**Step 3: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 4: Commit**

```bash
cd {WORKTREE_PATH} && git add -A && git commit -m "feat: add next-themes ThemeProvider for dark/light mode"
```

---

### Task 3.2: Create theme toggle component

**Files:**
- Create: `{WORKTREE_PATH}/apps/web/src/components/shell/theme-toggle.tsx`
- Modify: `{WORKTREE_PATH}/apps/web/src/components/shell/app-sidebar.tsx`

**Step 1: Create the theme toggle**

Create `{WORKTREE_PATH}/apps/web/src/components/shell/theme-toggle.tsx`:

```typescript
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

**Step 2: Add theme toggle to sidebar header**

In `{WORKTREE_PATH}/apps/web/src/components/shell/app-sidebar.tsx`:

Add import:
```typescript
import { ThemeToggle } from "./theme-toggle";
```

In the `SidebarHeader`, update the top row to include the theme toggle:

Find:
```typescript
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">I</span>
          </div>
          <span className="font-semibold group-data-[collapsible=icon]:hidden">
            Baker Street Tasks
          </span>
        </div>
```

Replace with:
```typescript
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">I</span>
          </div>
          <span className="flex-1 font-semibold group-data-[collapsible=icon]:hidden">
            Baker Street Tasks
          </span>
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
        </div>
```

**Step 3: Also add theme toggle to mobile header**

In `{WORKTREE_PATH}/apps/web/src/components/shell/shell-layout.tsx`:

Add import:
```typescript
import { ThemeToggle } from "./theme-toggle";
```

Update the mobile header:

Find:
```typescript
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-semibold">Baker Street Tasks</span>
        </header>
```

Replace with:
```typescript
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="flex-1 font-semibold">Baker Street Tasks</span>
          <ThemeToggle />
        </header>
```

**Step 4: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 5: Commit**

```bash
cd {WORKTREE_PATH} && git add -A && git commit -m "feat: add theme toggle to sidebar header and mobile header"
```

---

### Task 3.3: Fix hardcoded light-mode colors

**Files:**
- Modify: `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetail.tsx`

**Step 1: Fix focus button colors**

In `{WORKTREE_PATH}/apps/web/src/components/tasks/TaskDetail.tsx`, find:

```typescript
                  "w-full justify-start gap-2",
                  isFocus && "border-yellow-300 bg-yellow-50"
```

Replace with:
```typescript
                  "w-full justify-start gap-2",
                  isFocus && "border-yellow-500/50 bg-yellow-500/10"
```

This uses opacity-based colors that work in both light and dark mode.

**Step 2: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 3: Commit**

```bash
cd {WORKTREE_PATH} && git add apps/web/src/components/tasks/TaskDetail.tsx && git commit -m "fix: use theme-safe colors for focus button"
```

---

### Task 3.4: Add loading skeletons for main pages

**Files:**
- Create: `{WORKTREE_PATH}/apps/web/src/app/(shell)/loading.tsx`
- Create: `{WORKTREE_PATH}/apps/web/src/app/(shell)/tasks/loading.tsx`
- Create: `{WORKTREE_PATH}/apps/web/src/app/(shell)/captures/loading.tsx`
- Create: `{WORKTREE_PATH}/apps/web/src/app/(shell)/kanban/loading.tsx`

**Step 1: Create dashboard loading skeleton**

Create `{WORKTREE_PATH}/apps/web/src/app/(shell)/loading.tsx`:

```typescript
export default function DashboardLoading() {
  return (
    <div className="h-full overflow-auto">
      <div className="border-b px-4 py-3">
        <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-1 h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Create tasks loading skeleton**

Create `{WORKTREE_PATH}/apps/web/src/app/(shell)/tasks/loading.tsx`:

```typescript
export default function TasksLoading() {
  return (
    <div className="flex h-full">
      <div className="hidden lg:block w-60 border-r">
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-3">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create captures loading skeleton**

Create `{WORKTREE_PATH}/apps/web/src/app/(shell)/captures/loading.tsx`:

```typescript
export default function CapturesLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b px-4 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 border-b px-4 py-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Create kanban loading skeleton**

Create `{WORKTREE_PATH}/apps/web/src/app/(shell)/kanban/loading.tsx`:

```typescript
export default function KanbanLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-80 shrink-0 rounded-lg border bg-card p-3">
            <div className="mb-3 h-5 w-16 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              {Array.from({ length: 4 - i }).map((_, j) => (
                <div key={j} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Build and verify**

Run: `cd {WORKTREE_PATH} && pnpm -r build`
Expected: Build passes

**Step 6: Commit**

```bash
cd {WORKTREE_PATH} && git add -A && git commit -m "feat: add loading skeletons for dashboard, tasks, captures, and kanban pages"
```

---

## Merge Order

1. **Team 1 (Data Flow)** merges first — provides API changes and `allTags` prop
2. **Team 2 (Task Actions)** merges second — rebases on Team 1's changes to consume `allTags` prop
3. **Team 3 (Theme & Polish)** merges third — touches mostly separate files, minimal conflict surface

After each merge, run integration: `pnpm install && pnpm -r build`
