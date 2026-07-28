# TV Task Viewer — Design

**Date:** 2026-07-19
**Status:** Approved

## Purpose

Read-only, glanceable task views for a Samsung TV, driven by a dedicated
Linux/Windows machine over HDMI running a modern browser. A future rotating
Home-Assistant-style dashboard host will cycle between the views; each view is
therefore its own URL. No interactivity — display only.

## Decisions

- **Location:** Inside the existing `apps/web` Next.js app (the repo is already
  a pnpm/Turbo monorepo — no new package, no new repo). Considered and rejected:
  a new `apps/tv` package and a separate repo — both add an API surface, auth
  decision, Dockerfile, and k8s manifest for three read-only screens.
- **Runtime:** Modern Chromium on the HDMI machine — no Tizen/legacy-browser
  constraints.
- **Freshness:** Silent poll every 60 seconds; at most a minute stale is
  acceptable.
- **Auth:** None, matching the app's existing no-auth posture. `/tv/*` is
  readable by anything on the LAN that can reach the pod. Accepted risk.
- **Deployment:** Ships inside the existing image to the single k3s pod on
  a dedicated display host. The rotation host points at `http://<host>:3000/tv/<view>`.

## Routes

New route group `apps/web/src/app/tv/` — sibling of `(shell)`, so no
sidebar/nav chrome.

| Route | Content |
|-------|---------|
| `/tv/today` | Three sections: Overdue, Due Today, Focus |
| `/tv/kanban` | Read-only columns by status: Inbox, Active, Someday |
| `/tv/week` | Tasks due in the next 7 days grouped by day. Excludes overdue (today view's job) and tasks with no due date. |

`tv/layout.tsx`: fixed full-viewport dark surface, large type (couch-distance
readable), hidden cursor, footer with clock and "updated Ns ago".

## Data flow

Pages are React Server Components calling the existing `lib/api` layer directly
(in-process SQLite). No new API routes, no TanStack Query.

- `/tv/today` → existing `getOverdueTasks()`, `getDueTodayTasks()`,
  `getFocusTasks()` (`lib/api/tasks.ts`)
- `/tv/kanban` → existing `getTasks()` with status filter, grouped by status
- `/tv/week` → **new** `getUpcomingTasks(days = 7)` in `lib/api/tasks.ts`,
  following the `getDueTodayTasks` pattern: due date in `(end of today, today
  + 7 days]`, excludes Done/Archived, excludes null `dueAt`

All three pages export `const dynamic = "force-dynamic"` so every request hits
SQLite fresh.

## Refresh

One client component, `TvAutoRefresh`, mounted in `tv/layout.tsx`: calls
`router.refresh()` on a 60s interval. The server re-renders and React swaps
content in place — no reload flicker. A failed refresh leaves the previous
content on screen; the next tick retries.

## Components

New `components/tv/`:

- `TvSection` — section header, count badge, empty state
- `TvTaskRow` — title, priority indicator, due date, tags
- `TvKanbanColumn` — column header + stack of cards

Display-only. Deliberately not shared with the interactive dashboard blocks
(different density, font scale, no handlers), but they use the same semantic
OKLCH tokens (`--status-*`, `--priority-*`, `--date-*`) and the canonical
`Task` type from `lib/types`, keeping the TV visually consistent with the app.

## Error handling

`tv/error.tsx` boundary renders a minimal "Tasks unavailable" screen — the
rotation host must never display a stack trace. `TvAutoRefresh` keeps ticking,
so recovery is automatic once the backend is healthy.

## Testing

- Vitest unit tests for `getUpcomingTasks`: today excluded, day-7 boundary
  included, day-8 excluded, Done/Archived excluded, null `dueAt` excluded
- Existing pre-commit gates: `pnpm lint` + `pnpm typecheck`
- No E2E — the pages are read-only projections of already-tested queries
