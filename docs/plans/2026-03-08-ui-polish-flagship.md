# UI Polish & Flagship Quality Pass — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Baker Street Tasks look like a flagship AI productivity app with semantic color tokens, toast notifications, expanded navigation, polished dashboard cards, improved empty states, slide-in animations, and markdown preview.

**Architecture:** 9 tasks sequenced to minimize merge conflicts on shared files (globals.css, TaskDetail.tsx, KanbanColumn.tsx). Foundation tasks (color tokens, Sonner install) come first so downstream tasks can reference them. Each task targets a distinct UI concern.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4 (OKLCH), shadcn/ui, Sonner, react-markdown, @tailwindcss/typography

---

<!-- Validated: 2026-03-08 | Design ✅ | Dev ✅ | Security ✅ | Backlog ✅ -->

### Task 1: Semantic Color Tokens + Animation Keyframes

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/shared/StatusBadge.tsx`
- Modify: `apps/web/src/components/shared/PriorityIndicator.tsx`
- Modify: `apps/web/src/components/shared/DueDateDisplay.tsx`
- Modify: `apps/web/src/components/shared/AiBadge.tsx`
- Modify: `apps/web/src/components/shared/SubtaskProgress.tsx`
- Modify: `apps/web/src/components/shared/TaskRow.tsx`
- Modify: `apps/web/src/components/kanban/KanbanColumn.tsx`
- Modify: `apps/web/src/components/kanban/KanbanCard.tsx`
- Modify: `apps/web/src/components/dashboard/OverdueBlock.tsx`
- Modify: `apps/web/src/components/dashboard/DueTodayBlock.tsx`
- Modify: `apps/web/src/components/dashboard/FocusBlock.tsx`
- Modify: `apps/web/src/components/dashboard/NextUpBlock.tsx`
- Modify: `apps/web/src/components/dashboard/HighPriorityBlock.tsx`
- Modify: `apps/web/src/components/dashboard/InboxBlock.tsx`
- Modify: `apps/web/src/lib/utils/statuses.ts`
- Modify: `apps/web/src/lib/utils/priorities.ts`
- Modify: `apps/web/src/lib/utils.ts`

**Step 1: Add semantic color tokens and animation keyframes to globals.css**

Add the following CSS custom properties to `:root` (light mode) in `globals.css`, after the existing `--chart-5` line:

```css
  /* Status colors */
  --status-inbox: oklch(0.556 0 0);
  --status-inbox-bg: oklch(0.965 0 0);
  --status-active: oklch(0.488 0.15 264);
  --status-active-bg: oklch(0.932 0.032 264);
  --status-someday: oklch(0.496 0.155 293);
  --status-someday-bg: oklch(0.932 0.032 293);
  --status-done: oklch(0.488 0.15 152);
  --status-done-bg: oklch(0.932 0.032 152);
  --status-archived: oklch(0.45 0 0);
  --status-archived-bg: oklch(0.97 0 0);

  /* Priority colors */
  --priority-p0: oklch(0.577 0.245 27);
  --priority-p0-bg: oklch(0.97 0.014 27);
  --priority-p0-border: oklch(0.85 0.06 27);
  --priority-p1: oklch(0.577 0.2 55);
  --priority-p1-bg: oklch(0.97 0.014 55);
  --priority-p1-border: oklch(0.85 0.06 55);
  --priority-p2: oklch(0.488 0.15 264);
  --priority-p2-bg: oklch(0.932 0.032 264);
  --priority-p2-border: oklch(0.85 0.06 264);
  --priority-p3: oklch(0.556 0 0);
  --priority-p3-bg: oklch(0.97 0 0);
  --priority-p3-border: oklch(0.85 0 0);

  /* Date semantic */
  --date-overdue: oklch(0.577 0.245 27);
  --date-today: oklch(0.577 0.2 55);

  /* Accent semantic */
  --focus-star: oklch(0.795 0.184 86);
  --ai-badge: oklch(0.496 0.155 293);
  --ai-badge-bg: oklch(0.932 0.032 293);
  --progress-complete: oklch(0.59 0.15 152);
```

Add to `.dark` section, after `--chart-5`:

```css
  /* Status colors */
  --status-inbox: oklch(0.708 0 0);
  --status-inbox-bg: oklch(0.269 0 0);
  --status-active: oklch(0.65 0.15 264);
  --status-active-bg: oklch(0.22 0.04 264);
  --status-someday: oklch(0.65 0.155 293);
  --status-someday-bg: oklch(0.22 0.04 293);
  --status-done: oklch(0.65 0.15 152);
  --status-done-bg: oklch(0.22 0.04 152);
  --status-archived: oklch(0.556 0 0);
  --status-archived-bg: oklch(0.2 0 0);

  /* Priority colors */
  --priority-p0: oklch(0.637 0.237 25);
  --priority-p0-bg: oklch(0.2 0.04 25);
  --priority-p0-border: oklch(0.35 0.1 25);
  --priority-p1: oklch(0.637 0.2 55);
  --priority-p1-bg: oklch(0.2 0.04 55);
  --priority-p1-border: oklch(0.35 0.1 55);
  --priority-p2: oklch(0.65 0.15 264);
  --priority-p2-bg: oklch(0.2 0.04 264);
  --priority-p2-border: oklch(0.35 0.06 264);
  --priority-p3: oklch(0.637 0 0);
  --priority-p3-bg: oklch(0.2 0 0);
  --priority-p3-border: oklch(0.35 0 0);

  /* Date semantic */
  --date-overdue: oklch(0.637 0.237 25);
  --date-today: oklch(0.637 0.2 55);

  /* Accent semantic */
  --focus-star: oklch(0.795 0.184 86);
  --ai-badge: oklch(0.65 0.155 293);
  --ai-badge-bg: oklch(0.22 0.04 293);
  --progress-complete: oklch(0.65 0.15 152);
```

Add animation keyframes before `@layer base`:

```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

Add to `@theme inline` block:

```css
  --animate-slide-in-right: slide-in-right 200ms ease-out;
```

**Step 2: Update StatusBadge.tsx to use CSS custom properties**

Replace the entire `TASK_STATUS_STYLES` record:

```tsx
const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  Inbox: "text-[var(--status-inbox)] bg-[var(--status-inbox-bg)]",
  Active: "text-[var(--status-active)] bg-[var(--status-active-bg)]",
  Someday: "text-[var(--status-someday)] bg-[var(--status-someday-bg)]",
  Done: "text-[var(--status-done)] bg-[var(--status-done-bg)]",
  Archived: "text-[var(--status-archived)] bg-[var(--status-archived-bg)]",
};
```

**Step 3: Update PriorityIndicator.tsx**

Replace `PRIORITY_STYLES`:

```tsx
const PRIORITY_STYLES: Record<Priority, string> = {
  P0: "text-[var(--priority-p0)] bg-[var(--priority-p0-bg)] border-[var(--priority-p0-border)]",
  P1: "text-[var(--priority-p1)] bg-[var(--priority-p1-bg)] border-[var(--priority-p1-border)]",
  P2: "text-[var(--priority-p2)] bg-[var(--priority-p2-bg)] border-[var(--priority-p2-border)]",
  P3: "text-[var(--priority-p3)] bg-[var(--priority-p3-bg)] border-[var(--priority-p3-border)]",
};
```

**Step 4: Update DueDateDisplay.tsx**

Replace the hardcoded color classes:

```tsx
overdue && "font-medium text-[var(--date-overdue)]",
today && !overdue && "font-medium text-[var(--date-today)]",
```

**Step 5: Update AiBadge.tsx**

Replace the hardcoded classes:

```tsx
"inline-flex items-center gap-0.5 rounded-full bg-[var(--ai-badge-bg)] px-1.5 py-0 text-[10px] font-medium text-[var(--ai-badge)]",
```

**Step 6: Update SubtaskProgress.tsx**

Replace `bg-green-500` with `bg-[var(--progress-complete)]`.

**Step 7: Update TaskRow.tsx focus star**

Replace `fill-yellow-400 text-yellow-400` with `fill-[var(--focus-star)] text-[var(--focus-star)]`.

**Step 8: Update KanbanCard.tsx focus star**

Replace `fill-yellow-400 text-yellow-400` with `fill-[var(--focus-star)] text-[var(--focus-star)]`.

**Step 9: Update KanbanColumn.tsx border colors**

Replace `COLUMN_STYLES`:

```tsx
const COLUMN_STYLES: Record<string, string> = {
  Inbox: "border-t-[var(--status-inbox)]",
  Active: "border-t-[var(--status-active)]",
  Someday: "border-t-[var(--status-someday)]",
  Done: "border-t-[var(--status-done)]",
};
```

**Step 10: Update dashboard block icon colors**

- `OverdueBlock.tsx`: Replace `text-red-500` with `text-[var(--date-overdue)]`
- `DueTodayBlock.tsx`: Replace `text-orange-500` with `text-[var(--date-today)]`
- `FocusBlock.tsx`: Replace `fill-yellow-400 text-yellow-400` with `fill-[var(--focus-star)] text-[var(--focus-star)]`
- `NextUpBlock.tsx`: Replace `text-blue-500` with `text-[var(--status-active)]`
- `HighPriorityBlock.tsx`: Replace `text-orange-500` with `text-[var(--priority-p1)]`
- `InboxBlock.tsx`: Replace `text-gray-500` with `text-[var(--status-inbox)]`

**Step 11: Update statuses.ts**

Replace the hardcoded `color` and `bgColor` values:

```tsx
export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  Inbox: {
    label: "Inbox",
    color: "text-[var(--status-inbox)]",
    bgColor: "bg-[var(--status-inbox-bg)]",
    icon: "inbox",
  },
  Active: {
    label: "Active",
    color: "text-[var(--status-active)]",
    bgColor: "bg-[var(--status-active-bg)]",
    icon: "circle-play",
  },
  Someday: {
    label: "Someday",
    color: "text-[var(--status-someday)]",
    bgColor: "bg-[var(--status-someday-bg)]",
    icon: "cloud",
  },
  Done: {
    label: "Done",
    color: "text-[var(--status-done)]",
    bgColor: "bg-[var(--status-done-bg)]",
    icon: "check-circle",
  },
  Archived: {
    label: "Archived",
    color: "text-[var(--status-archived)]",
    bgColor: "bg-[var(--status-archived-bg)]",
    icon: "archive",
  },
};
```

**Step 12: Update priorities.ts**

Replace the hardcoded `color`, `bgColor`, `borderColor` values:

```tsx
export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bgColor: string; borderColor: string; sortOrder: number }
> = {
  P0: {
    label: "Urgent",
    color: "text-[var(--priority-p0)]",
    bgColor: "bg-[var(--priority-p0-bg)]",
    borderColor: "border-[var(--priority-p0-border)]",
    sortOrder: 0,
  },
  P1: {
    label: "High",
    color: "text-[var(--priority-p1)]",
    bgColor: "bg-[var(--priority-p1-bg)]",
    borderColor: "border-[var(--priority-p1-border)]",
    sortOrder: 1,
  },
  P2: {
    label: "Medium",
    color: "text-[var(--priority-p2)]",
    bgColor: "bg-[var(--priority-p2-bg)]",
    borderColor: "border-[var(--priority-p2-border)]",
    sortOrder: 2,
  },
  P3: {
    label: "Low",
    color: "text-[var(--priority-p3)]",
    bgColor: "bg-[var(--priority-p3-bg)]",
    borderColor: "border-[var(--priority-p3-border)]",
    sortOrder: 3,
  },
};
```

**Step 13: Update utils.ts statusColor() and priorityColor()**

Replace `statusColor()`:

```tsx
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    Inbox: "text-[var(--status-inbox)] bg-[var(--status-inbox-bg)]",
    Active: "text-[var(--status-active)] bg-[var(--status-active-bg)]",
    Someday: "text-[var(--status-someday)] bg-[var(--status-someday-bg)]",
    Done: "text-[var(--status-done)] bg-[var(--status-done-bg)]",
    Archived: "text-[var(--status-archived)] bg-[var(--status-archived-bg)]",
  };
  return map[status] ?? "text-[var(--status-inbox)] bg-[var(--status-inbox-bg)]";
}
```

Replace `priorityColor()`:

```tsx
export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    P0: "text-[var(--priority-p0)] bg-[var(--priority-p0-bg)] border-[var(--priority-p0-border)]",
    P1: "text-[var(--priority-p1)] bg-[var(--priority-p1-bg)] border-[var(--priority-p1-border)]",
    P2: "text-[var(--priority-p2)] bg-[var(--priority-p2-bg)] border-[var(--priority-p2-border)]",
    P3: "text-[var(--priority-p3)] bg-[var(--priority-p3-bg)] border-[var(--priority-p3-border)]",
  };
  return map[priority] ?? "text-[var(--priority-p3)] bg-[var(--priority-p3-bg)] border-[var(--priority-p3-border)]";
}
```

**Step 14: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 15: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/shared/ apps/web/src/components/kanban/KanbanColumn.tsx apps/web/src/components/kanban/KanbanCard.tsx apps/web/src/components/dashboard/ apps/web/src/lib/utils.ts apps/web/src/lib/utils/statuses.ts apps/web/src/lib/utils/priorities.ts
git commit -m "feat(ui): extract semantic color tokens and add animation keyframes"
```

---

### Task 2: Install Sonner + Toaster

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/components/ui/sonner.tsx` (via shadcn CLI)
- Modify: `apps/web/src/app/layout.tsx`

**Step 1: Install Sonner via shadcn CLI**

Run from the monorepo root:

```bash
cd apps/web && npx shadcn@latest add sonner
```

This creates `apps/web/src/components/ui/sonner.tsx` and adds `sonner` to `apps/web/package.json`.

**Step 2: Add Toaster to layout.tsx**

In `apps/web/src/app/layout.tsx`, add the import:

```tsx
import { Toaster } from "@/components/ui/sonner";
```

Add `<Toaster richColors position="bottom-right" />` inside the `<ThemeProvider>`, after `<QueryProvider>`:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="dark"
  enableSystem
  disableTransitionOnChange
>
  <NuqsAdapter>
    <QueryProvider>{children}</QueryProvider>
  </NuqsAdapter>
  <Toaster richColors position="bottom-right" offset="80px" />
</ThemeProvider>
```

The `offset="80px"` pushes toasts above the mobile bottom nav (h-16 = 64px + 16px margin).

**Step 3: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/components/ui/sonner.tsx apps/web/src/app/layout.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(ui): install Sonner toast library and add Toaster to layout"
```

---

### Task 3: Toast Notifications for All Error Handlers

**Files:**
- Modify: `apps/web/src/components/tasks/TaskCreateDialog.tsx`
- Modify: `apps/web/src/components/tasks/TaskDetail.tsx`
- Modify: `apps/web/src/components/tasks/TaskDetailPanels.tsx`
- Modify: `apps/web/src/components/tasks/TaskList.tsx`
- Modify: `apps/web/src/app/(shell)/dashboard-client.tsx`
- Modify: `apps/web/src/app/(shell)/kanban/kanban-page-client.tsx`
- Modify: `apps/web/src/components/kanban/KanbanBoard.tsx`
- Modify: `apps/web/src/app/(shell)/tasks/tasks-page-client.tsx`
- Modify: `apps/web/src/app/(shell)/tasks/[taskId]/task-detail-mobile-client.tsx`
- Modify: `apps/web/src/app/(shell)/settings/settings-page-client.tsx`
- Modify: `apps/web/src/app/(shell)/search/search-page-client.tsx`

**Step 1: Add toast imports and calls to each file**

In every file, add `import { toast } from "sonner";` at the top.

**Toast message guide (follow exactly):**

| File | Operation | Success toast | Error toast |
|------|-----------|---------------|-------------|
| TaskCreateDialog.tsx | Create task | `toast.success("Task created")` | `toast.error("Failed to create task")` |
| TaskDetail.tsx | saveField | No success (too noisy) | `toast.error("Failed to update task")` |
| TaskDetail.tsx | handleConfirmComplete | `toast.success("Task completed")` | `toast.error("Failed to complete task")` |
| TaskDetail.tsx | handleDelete | `toast.success("Task deleted")` | `toast.error("Failed to delete task")` |
| TaskDetail.tsx | handleRemoveTag | No success | `toast.error("Failed to update tags")` |
| TaskDetail.tsx | handleAddTag | No success | `toast.error("Failed to update tags")` |
| TaskDetailPanels.tsx | Add subtask | No success | `toast.error("Failed to add subtask")` |
| TaskDetailPanels.tsx | Toggle subtask | No success | `toast.error("Failed to update subtask")` |
| TaskDetailPanels.tsx | Delete subtask | No success | `toast.error("Failed to delete subtask")` |
| TaskList.tsx | Toggle complete | No success (checkbox is feedback) | `toast.error("Failed to update task")` |
| dashboard-client.tsx | Toggle complete | No success | `toast.error("Failed to update task")` |
| KanbanBoard.tsx | Drag-drop update | No success (visual feedback) | `toast.error("Failed to move task")` |
| tasks-page-client.tsx | refreshTasks | No toast (background) | No toast (background) |
| tasks-page-client.tsx | handleTaskSelect | No toast | No toast |
| kanban-page-client.tsx | refresh | No toast | No toast |
| task-detail-mobile-client.tsx | Error catch | Context-dependent | `toast.error("Failed to load task")` |
| settings-page-client.tsx | createTag | `toast.success("Tag created")` | `toast.error("Failed to create tag")` |
| settings-page-client.tsx | updateTag | `toast.success("Tag updated")` | `toast.error("Failed to update tag")` |
| settings-page-client.tsx | deleteTag | `toast.success("Tag deleted")` | `toast.error("Failed to delete tag")` |
| search-page-client.tsx | searchTasks | No success | `toast.error("Search failed")` |

**For settings-page-client.tsx** — this file has NO try/catch at all. Wrap each server action call in try/catch:

```tsx
// Example pattern for createTag:
try {
  await createTag({ name, color });
  toast.success("Tag created");
} catch {
  toast.error("Failed to create tag");
}
```

**For search-page-client.tsx** — wrap `searchTasks` call in try/catch:

```tsx
startTransition(async () => {
  try {
    const taskResults = await searchTasks(searchQuery);
    setTasks(taskResults);
    setHasSearched(true);
  } catch {
    toast.error("Search failed");
  }
});
```

**Step 2: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/components/tasks/ apps/web/src/app/ apps/web/src/components/kanban/KanbanBoard.tsx
git commit -m "feat(ui): add toast notifications for all user-facing operations"
```

---

### Task 4: Kanban Someday Column + Seed View

**Files:**
- Modify: `apps/web/src/components/kanban/KanbanBoard.tsx`
- Modify: `packages/db/src/seed.ts`

**Step 1: Add Someday to KanbanBoard COLUMNS**

In `KanbanBoard.tsx`, change line 30:

```tsx
const COLUMNS: TaskStatus[] = ["Inbox", "Active", "Someday", "Done"];
```

Also add Someday to the sort loop — the `for (const status of COLUMNS)` on line 69 already iterates COLUMNS, so this is automatic.

**Step 2: Add Someday system view to seed**

In `packages/db/src/seed.ts`, add to the `values` array after the Active view:

```tsx
{
  name: "Someday",
  type: "Tasks",
  isSystem: true,
  sortOrder: 3,
  filterDefinition: { status: ["Someday"] },
},
```

**Step 3: Run lint + typecheck + seed**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/components/kanban/KanbanBoard.tsx packages/db/src/seed.ts
git commit -m "feat: add Someday column to Kanban board and seed system view"
```

---

### Task 5: Bottom Nav Expansion

**Files:**
- Modify: `apps/web/src/components/shell/bottom-nav.tsx`

**Step 1: Add Search and Settings to NAV_ITEMS**

Replace the entire file content of `bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Columns3,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/kanban", label: "Kanban", icon: Columns3 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-2 py-2 text-[10px] transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

Key changes:
- Added `Search` and `Settings` icons from lucide-react
- Shortened "Dashboard" to "Home" to fit 5 items
- Reduced `gap-1` to `gap-0.5`, `text-xs` to `text-[10px]`, `px-3` to `px-2` for tighter fit with 5 items
- Added `min-h-[44px] min-w-[44px]` for WCAG 2.5.8 touch target compliance
- Added `py-2` and `justify-center` for adequate vertical spacing

**Step 2: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/components/shell/bottom-nav.tsx
git commit -m "feat(ui): expand bottom nav with Search and Settings"
```

---

### Task 6: Dashboard Card Polish + Celebration Empty States

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardBlock.tsx`
- Modify: `apps/web/src/components/dashboard/OverdueBlock.tsx`
- Modify: `apps/web/src/components/dashboard/DueTodayBlock.tsx`

**Step 1: Polish DashboardBlock.tsx**

Replace the `<Card>` wrapper to add shadow, hover lift, and improved empty state:

```tsx
<Card className={cn("flex flex-col shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5", className)}>
```

Replace the empty state paragraph:

```tsx
{isEmpty ? (
  <div className="flex flex-col items-center justify-center px-2 py-6 text-center">
    {emptyIcon && <div className="mb-2">{emptyIcon}</div>}
    <p className="text-xs text-muted-foreground">
      {emptyMessage}
    </p>
  </div>
) : (
  <div className="divide-y">{children}</div>
)}
```

Add `emptyIcon?: React.ReactNode;` to `DashboardBlockProps`.

**Step 2: Add celebration empty states to OverdueBlock.tsx**

```tsx
import { AlertTriangle, CheckCircle2 } from "lucide-react";
```

Add `emptyIcon` prop to the DashboardBlock call:

```tsx
<DashboardBlock
  title="Overdue"
  count={tasks.length}
  viewAllHref="/tasks?view=all&sort=due_date"
  icon={<AlertTriangle className="h-4 w-4 text-[var(--date-overdue)]" />}
  emptyMessage="All caught up!"
  emptyIcon={<CheckCircle2 className="h-8 w-8 text-[var(--status-done)]" />}
>
```

**Step 3: Add celebration empty state to DueTodayBlock.tsx**

```tsx
import { Calendar, CheckCircle2 } from "lucide-react";
```

```tsx
<DashboardBlock
  title="Due Today"
  count={tasks.length}
  viewAllHref="/tasks?view=all&sort=due_date"
  icon={<Calendar className="h-4 w-4 text-[var(--date-today)]" />}
  emptyMessage="Nothing due today — you're ahead!"
  emptyIcon={<CheckCircle2 className="h-8 w-8 text-[var(--status-done)]" />}
>
```

**Step 4: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/
git commit -m "feat(ui): polish dashboard cards with shadows, hover lift, and celebration empty states"
```

---

### Task 7: Empty State Improvements

**Files:**
- Modify: `apps/web/src/components/tasks/TaskList.tsx`
- Modify: `apps/web/src/components/kanban/KanbanColumn.tsx`
- Modify: `apps/web/src/app/(shell)/search/search-page-client.tsx`

**Step 1: Improve TaskList empty state**

Replace the `EmptyState` component in `TaskList.tsx`:

```tsx
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="mt-4 text-base font-medium">No tasks match your filters</h3>
      <p className="mt-1 max-w-[240px] text-sm text-muted-foreground">
        Try adjusting your view or create a new task to get started.
      </p>
    </div>
  );
}
```

**Step 2: Improve KanbanColumn empty state**

Replace the empty state block in `KanbanColumn.tsx`:

```tsx
{tasks.length === 0 && (
  <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 text-center">
    <p className="text-xs font-medium text-muted-foreground">
      No {status.toLowerCase()} tasks
    </p>
    <p className="text-[10px] text-muted-foreground/60">
      Drag tasks here
    </p>
  </div>
)}
```

**Step 3: Improve search empty states**

Replace the initial search state in `search-page-client.tsx`:

```tsx
{!hasSearched && !isPending && (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="rounded-full bg-muted p-4">
      <Search className="h-10 w-10 text-muted-foreground/40" />
    </div>
    <p className="mt-4 text-sm font-medium">Search your tasks</p>
    <p className="mt-1 text-xs text-muted-foreground">
      Find tasks by title, notes, or tags
    </p>
  </div>
)}
```

Replace the no-results state:

```tsx
{hasSearched && tasks.length === 0 && !isPending && (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="rounded-full bg-muted p-4">
      <Search className="h-10 w-10 text-muted-foreground/40" />
    </div>
    <p className="mt-4 text-sm font-medium">No matches found</p>
    <p className="mt-1 text-xs text-muted-foreground">
      Try different keywords for &ldquo;{query}&rdquo;
    </p>
  </div>
)}
```

**Step 4: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/tasks/TaskList.tsx apps/web/src/components/kanban/KanbanColumn.tsx apps/web/src/app/(shell)/search/search-page-client.tsx
git commit -m "feat(ui): improve empty states across task list, kanban, and search"
```

---

### Task 8: Detail Panel Slide-in Animation

**Files:**
- Modify: `apps/web/src/app/(shell)/tasks/tasks-page-client.tsx`

**Step 1: Add slide-in animation to the detail panel**

Replace the detail panel render block (lines 116-133):

```tsx
{/* Right detail */}
{currentTask && (
  <div
    key={currentTask.id}
    className="hidden md:block motion-safe:animate-slide-in-right"
  >
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
```

Key details:
- `key={currentTask.id}` forces remount when switching tasks, replaying the animation
- `motion-safe:` prefix respects `prefers-reduced-motion` — users who prefer reduced motion see no animation (WCAG 2.1 SC 2.3.3)
- The `animate-slide-in-right` class uses the keyframe defined in Task 1 (`--animate-slide-in-right` in `@theme inline`)

**Step 2: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/(shell)/tasks/tasks-page-client.tsx
git commit -m "feat(ui): add slide-in animation for task detail panel"
```

---

### Task 9: Markdown Preview for Notes

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/tasks/TaskDetail.tsx`

**Step 1: Install dependencies**

```bash
pnpm add react-markdown @tailwindcss/typography --filter @baker-street/web
```

**Step 2: Add typography plugin to globals.css**

Add after the `@import "tailwindcss";` line:

```css
@plugin "@tailwindcss/typography";
```

**Step 3: Add markdown preview toggle to TaskDetail.tsx**

Add imports at the top of the file:

```tsx
import ReactMarkdown from "react-markdown";
import { Eye, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
```

Add state variable alongside other state:

```tsx
const [notesPreview, setNotesPreview] = useState(false);
```

In the notes section of TaskDetail, replace the notes label + textarea with:

```tsx
<div className="flex items-center justify-between">
  <label className="text-xs font-medium text-muted-foreground">
    Notes
  </label>
  {task.notes && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setNotesPreview(!notesPreview)}
          aria-label={notesPreview ? "Edit notes" : "Preview markdown"}
        >
          {notesPreview ? (
            <Pencil className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {notesPreview ? "Edit notes" : "Preview markdown"}
      </TooltipContent>
    </Tooltip>
  )}
</div>

{notesPreview ? (
  task.notes?.trim() ? (
    <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-input px-3 py-2">
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {task.notes}
      </ReactMarkdown>
    </div>
  ) : (
    <div className="rounded-md border border-input px-3 py-2 text-sm text-muted-foreground">
      Add notes...
    </div>
  )
) : (
  <textarea ... />  {/* existing textarea unchanged */}
)}
```

Key details:
- `aria-label` changes based on preview state for screen readers
- `Tooltip` wrapping provides hover hint for sighted users
- Custom `a` component adds `target="_blank" rel="noopener noreferrer"` to all rendered links (security: prevents tab-napping from agent-authored notes)
- Empty/whitespace notes in preview mode show placeholder text instead of blank area

When switching from preview to edit, reset `notesPreview` to false when switching tasks:

```tsx
// Reset preview mode when task changes
useEffect(() => {
  setNotesPreview(false);
}, [task.id]);
```

**Note:** Ensure shadcn/ui Tooltip is installed (`npx shadcn@latest add tooltip` if not present). Also wrap the app in a `<TooltipProvider>` in layout.tsx if not already done.

**Step 4: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/tasks/TaskDetail.tsx apps/web/src/app/globals.css apps/web/package.json pnpm-lock.yaml
git commit -m "feat(ui): add markdown preview toggle for task notes"
```

---

## Verification

After all 9 tasks are complete, run the full verification:

```bash
pnpm lint && pnpm typecheck && pnpm build
```

All three must pass. The build step catches any runtime import issues that lint/typecheck miss.

## Summary

| Task | Description | Files Changed | Risk |
|------|-------------|---------------|------|
| 1 | Semantic color tokens + keyframes | ~18 files | Low (CSS-only foundation) |
| 2 | Install Sonner + Toaster | 3 files | Low (infrastructure) |
| 3 | Toast notifications | ~11 files | Medium (many files, but isolated catch blocks) |
| 4 | Kanban Someday + seed | 2 files | Low |
| 5 | Bottom nav expansion | 1 file | Low |
| 6 | Dashboard card polish | 3 files | Low |
| 7 | Empty state improvements | 3 files | Low |
| 8 | Detail panel animation | 1 file | Low |
| 9 | Markdown preview | 3 files | Low (new dependency) |
