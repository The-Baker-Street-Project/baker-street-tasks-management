# UI Fundamentals Audit & Fix — Design Document

**Date:** 2026-02-20
**Status:** Approved

---

## Problem Statement

A critical top-to-bottom UI review revealed 14 issues across the Baker Street Tasks web app. Several core features specified in the PRD (v0.5) are non-functional or missing. This design addresses all fundamental issues in a single coordinated wave before any new features are added.

---

## Findings Summary

### A. Broken / Non-functional (4 issues)

1. **Context toggle is local-only state** — `ContextToggle` uses `useState` with no connection to data fetching. Clicking Home/Work/All filters nothing.
2. **Saved view filtering incomplete** — System views map to status filters, but custom saved views with `filterDefinition` JSON are ignored. Tag filtering from URL params never reaches `getTasks()`.
3. **Tag filtering from sidebar broken** — Sidebar links to `/tasks?tag={id}` but the tasks page client never reads the `tag` query param.
4. **No dark mode toggle** — CSS defines `.dark` variant but no UI exists to activate it.

### B. Incomplete PRD Features (5 issues)

5. **No complete/reopen from task list or dashboard** — `TaskRow` has `showCheckbox`/`onToggleComplete` props but they're never wired up.
6. **No add-tag-to-task in detail panel** — `TagsPanel` only removes tags; no way to add.
7. **No subtask completion warning** — PRD 4.1.2 requires warning when completing parent with incomplete subtasks. Not implemented.
8. **Dashboard blocks are static** — No quick actions (complete, snooze, schedule) per PRD 3.2.
9. **No snooze action** — Listed as dashboard quick action in PRD. Deferred to Wave 2 (needs schema change).

### C. UI/UX Polish (5 issues)

10. **Focus button dark mode colors** — Hardcoded `border-yellow-300 bg-yellow-50` breaks in dark mode.
11. **CaptureList not virtualized** — Unlike TaskList. Deferred to Wave 2.
12. **KanbanSwimLane unused** — Built but not integrated. Deferred to Wave 2.
13. **No loading states for pages** — No `loading.tsx` or Suspense boundaries.
14. **Search capture results not clickable** — Task results link properly but captures have no navigation.

---

## Wave 1: Fundamentals — 3 Parallel Streams

### Stream 1: Data Flow & Filtering

**Goal:** Make context toggle, saved views, and tag filtering actually work end-to-end.

**Changes:**

| File | Change |
|------|--------|
| `context-toggle.tsx` | Replace `useState` with `nuqs` URL query state (`?context=`). Accept `onChange` callback. |
| `shell-layout.tsx` | Pass context state down or use URL-based approach. |
| `tasks-page-client.tsx` | Read `tag` and `context` from query state. Pass to `getTasks()`. Re-fetch when params change. |
| `captures-page-client.tsx` | Read `context` from query state. Pass to `getCaptures()`. |
| `tasks.ts` (API) | Add `context` filter param. Add `tagId` filter (join through `taskTags`). Handle custom saved view `filterDefinition` parsing. |
| `captures.ts` (API) | Add `context` filter param. |
| `app-sidebar.tsx` | Verify tag links produce correct URL params. |

**Key decisions:**
- Context is URL state (`?context=Home`), not component state — enables deep linking and persistence across navigation.
- Custom saved views with `filterDefinition` JSON: parse at query time and translate to Drizzle conditions. Support `status`, `context`, `tags`, `priority` filter keys.

### Stream 2: Task Actions & Interactions

**Goal:** Wire up complete/reopen, add-tag, subtask warnings, and fix search navigation.

**Changes:**

| File | Change |
|------|--------|
| `TaskList.tsx` | Pass `showCheckbox={true}` and `onToggleComplete` to `TaskRow`. Call `completeTask`/`reopenTask` server actions. |
| `TaskRow.tsx` | Already supports these props — no changes needed. |
| Dashboard blocks (`OverdueBlock`, `DueTodayBlock`, etc.) | Pass `showCheckbox={true}` and wire `onToggleComplete`. Make blocks client components where needed. |
| `DashboardBlock.tsx` | Accept optional `onToggleComplete` to pass through. |
| `TaskDetailPanels.tsx` (`TagsPanel`) | Add tag selector: dropdown or combobox showing available tags with search. Call `addTagToTask` on selection. Accept `allTags` prop. |
| `TaskDetail.tsx` | Pass `allTags` to `TagsPanel`. Fetch tags list (from layout or prop). |
| `tasks-page-client.tsx` | Pass `tags` to `TaskDetail` for the add-tag feature. |
| `TaskDetail.tsx` (status change) | Before setting status to "Done", check for incomplete subtasks. Show confirmation dialog listing incomplete subtasks. On confirm, complete all subtasks then set parent status. |
| `search-page-client.tsx` | Wrap capture results in links: `href={/captures?captureId=${capture.id}}`. |

**Key decisions:**
- Dashboard blocks that need interactivity (complete checkbox) become client components with server action calls, wrapped in `useTransition`.
- Subtask warning uses the existing `ConfirmDialog` component.
- Add-tag uses a simple `DropdownMenu` with existing tags, not a full combobox — keeps it simple for v1.

### Stream 3: Theme & Polish

**Goal:** Dark mode toggle, fix hardcoded colors, add page loading states.

**Changes:**

| File | Change |
|------|--------|
| `package.json` (web) | Add `next-themes` dependency. |
| `apps/web/src/app/layout.tsx` | Wrap app in `ThemeProvider` from `next-themes`. |
| New: `components/shell/theme-toggle.tsx` | Sun/Moon toggle button using `useTheme()` from `next-themes`. |
| `app-sidebar.tsx` | Add theme toggle to sidebar footer or header. |
| `TaskDetail.tsx` | Replace `border-yellow-300 bg-yellow-50` with theme-aware classes: `border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950`. |
| `KanbanCard.tsx` | Audit for any hardcoded light-mode colors. |
| New: `apps/web/src/app/(shell)/loading.tsx` | Skeleton loading for shell pages. |
| New: `apps/web/src/app/(shell)/tasks/loading.tsx` | Skeleton loading for tasks page. |
| New: `apps/web/src/app/(shell)/captures/loading.tsx` | Skeleton loading for captures page. |
| New: `apps/web/src/app/(shell)/kanban/loading.tsx` | Skeleton loading for kanban page. |

**Key decisions:**
- Use `next-themes` — standard Next.js approach, handles SSR hydration correctly, stores preference in `localStorage`.
- Loading skeletons reuse the existing `TaskRowSkeleton` pattern already in `TaskList.tsx`.
- Theme toggle placement: sidebar header, next to the "Baker Street Tasks" logo, visible on both mobile header and sidebar.

---

## Wave 2: New Features (Deferred)

These require schema changes or significant new UI patterns. Not in scope for Wave 1.

- **Snooze action** — Needs `snoozed_until` column on tasks table + migration + UI
- **Kanban swimlanes** — Wire up existing `KanbanSwimLane` component with saved views
- **CaptureList virtualization** — Port `@tanstack/react-virtual` pattern from TaskList
- **Dashboard quick actions** — Schedule, move-to-someday inline actions
- **Saved view CRUD from sidebar** — Create/edit/delete saved views inline

---

## File Ownership Matrix (No Conflicts Between Streams)

| File | Stream |
|------|--------|
| `context-toggle.tsx` | 1 |
| `tasks-page-client.tsx` | 1 (filtering) + 2 (tags prop) — Stream 1 goes first |
| `captures-page-client.tsx` | 1 |
| `tasks.ts` (API) | 1 |
| `captures.ts` (API) | 1 |
| `app-sidebar.tsx` | 1 (verify) + 3 (theme toggle) — separate sections |
| `TaskList.tsx` | 2 |
| `TaskRow.tsx` | 2 (verify only) |
| Dashboard blocks | 2 |
| `DashboardBlock.tsx` | 2 |
| `TaskDetailPanels.tsx` | 2 |
| `TaskDetail.tsx` | 2 (subtask warning) + 3 (dark mode colors) — separate sections |
| `search-page-client.tsx` | 2 |
| `layout.tsx` (root) | 3 |
| `theme-toggle.tsx` (new) | 3 |
| `loading.tsx` files (new) | 3 |

Conflict resolution: `tasks-page-client.tsx` is touched by both Stream 1 (adding context/tag params) and Stream 2 (passing tags to detail). Stream 1 completes first, Stream 2 builds on top. `TaskDetail.tsx` similarly: Stream 2 adds subtask warning logic, Stream 3 fixes colors — these touch different sections and can merge cleanly.

---

## Success Criteria

- [ ] Context toggle filters tasks and captures across all views
- [ ] Tag clicking in sidebar filters the task list
- [ ] Custom saved views with `filterDefinition` actually filter
- [ ] Complete/reopen checkboxes work in task list and dashboard blocks
- [ ] Tags can be added to tasks from the detail panel
- [ ] Completing a task with incomplete subtasks shows warning
- [ ] Capture search results are clickable and navigate to capture detail
- [ ] Dark mode toggle works and persists preference
- [ ] No hardcoded light-mode-only colors remain
- [ ] All main pages have loading skeletons
