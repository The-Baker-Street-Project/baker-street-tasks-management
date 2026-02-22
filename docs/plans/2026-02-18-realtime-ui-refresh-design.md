# Real-Time UI Refresh via Postgres LISTEN/NOTIFY + SSE

**Date:** 2026-02-18
**Status:** Approved

## Problem

Tasks created or edited via the MCP server don't appear in the web UI until the user manually refreshes. The MCP server and web app both write to the same Postgres database, but the UI has no mechanism to detect external changes.

## Solution

Postgres LISTEN/NOTIFY pushes change events to a Next.js SSE endpoint, which streams them to the browser. The browser calls `router.refresh()` to re-run server components and pick up new data.

## Architecture

```
┌──────────────┐     INSERT/UPDATE/DELETE     ┌───────────────┐
│  MCP Server  │ ──────────────────────────▶  │   Postgres    │
│  Web App     │                              │               │
└──────────────┘                              │  trigger fn   │
                                              │  pg_notify()  │
                                              └──────┬────────┘
                                                     │ NOTIFY entity_change
                                                     ▼
                                              ┌───────────────┐
                                              │  Next.js API  │
                                              │  GET /api/events │
                                              │  (LISTEN)     │
                                              └──────┬────────┘
                                                     │ SSE stream
                                                     ▼
                                              ┌───────────────┐
                                              │   Browser     │
                                              │  EventSource  │
                                              │  router.refresh() │
                                              └───────────────┘
```

## Layer 1: Database Migration

New migration `0002_add_entity_change_notify.sql`:

- A trigger function `notify_entity_change()` that calls `pg_notify('entity_change', json)` with payload `{"table": "<name>", "op": "INSERT|UPDATE|DELETE", "id": "<uuid>"}`.
- Triggers on `tasks`, `subtasks`, `captures` tables for INSERT, UPDATE, DELETE.
- Payload uses `NEW.id` for INSERT/UPDATE, `OLD.id` for DELETE.

## Layer 2: Next.js SSE Route Handler

New file `apps/web/src/app/api/events/route.ts`:

- `GET` handler that returns a `ReadableStream` with `text/event-stream` content type.
- Opens a dedicated Postgres connection (not from a pool) and runs `LISTEN entity_change`.
- On each notification, writes an SSE `data:` frame with the JSON payload.
- Sends a heartbeat comment every 30s to keep the connection alive.
- Cleans up (UNLISTEN + close connection) when the client disconnects via `signal.addEventListener('abort', ...)`.

## Layer 3: Browser Hook

New file `apps/web/src/hooks/use-realtime-refresh.ts`:

- `useRealtimeRefresh()` hook that creates an `EventSource` to `/api/events`.
- On `message` event, calls `router.refresh()` from `next/navigation`.
- Debounces rapid events (e.g. bulk updates) to avoid excessive refreshes — 500ms window.
- Auto-reconnects on error (EventSource does this natively).
- Cleans up on unmount.

## Layer 4: Integration

Mount a `<RealtimeRefresh />` client component in the shell layout (`apps/web/src/app/(shell)/layout.tsx`). This is rendered once and persists across all shell pages.

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `packages/db/drizzle/0002_add_entity_change_notify.sql` | New | Trigger function + triggers |
| `apps/web/src/app/api/events/route.ts` | New | SSE endpoint with LISTEN |
| `apps/web/src/hooks/use-realtime-refresh.ts` | New | EventSource + router.refresh() |
| `apps/web/src/components/shell/realtime-refresh.tsx` | New | Thin client component wrapper |
| `apps/web/src/app/(shell)/layout.tsx` | Edit | Mount RealtimeRefresh |

## No New Dependencies

- `postgres` driver already supports LISTEN/NOTIFY
- `EventSource` is a browser built-in
- `ReadableStream` is supported in Next.js Route Handlers
- `router.refresh()` is built into Next.js App Router

## Trade-offs

- **One Postgres connection per browser tab** for LISTEN. Acceptable for a single-user app. If scaling needed later, could multiplex via a shared listener process.
- **`router.refresh()` refetches all server components on the page**, not just the changed entity. This is simple and correct but slightly heavier than targeted invalidation. Fine for this app's data volume.
- **No filtering** — all entity changes trigger a refresh. Could add client-side filtering later if needed.
