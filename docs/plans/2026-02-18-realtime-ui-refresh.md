# Real-Time UI Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the web UI update instantly when tasks/captures are created or edited via the MCP server (or any other database writer).

**Architecture:** Postgres triggers fire `pg_notify` on mutations to tasks/subtasks/captures. A Next.js SSE route handler `LISTEN`s and streams events to the browser. A client hook receives events and calls `router.refresh()` to re-run server components.

**Tech Stack:** Postgres LISTEN/NOTIFY, Next.js Route Handlers (ReadableStream SSE), EventSource browser API, `next/navigation` router.refresh()

---

### Task 1: Database Migration — NOTIFY trigger

**Files:**
- Create: `packages/db/drizzle/0002_add_entity_change_notify.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`

**Step 1: Write the migration SQL**

Create `packages/db/drizzle/0002_add_entity_change_notify.sql`:

```sql
-- Trigger function: sends pg_notify on entity changes
CREATE OR REPLACE FUNCTION notify_entity_change() RETURNS trigger AS $$
DECLARE
  row_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
  ELSE
    row_id := NEW.id;
  END IF;

  PERFORM pg_notify('entity_change', json_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'id', row_id
  )::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER tasks_entity_change
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_entity_change();--> statement-breakpoint

CREATE TRIGGER subtasks_entity_change
  AFTER INSERT OR UPDATE OR DELETE ON subtasks
  FOR EACH ROW EXECUTE FUNCTION notify_entity_change();--> statement-breakpoint

CREATE TRIGGER captures_entity_change
  AFTER INSERT OR UPDATE OR DELETE ON captures
  FOR EACH ROW EXECUTE FUNCTION notify_entity_change();
```

**Step 2: Update the Drizzle migration journal**

Add a new entry to `packages/db/drizzle/meta/_journal.json`:

```json
{
  "idx": 2,
  "version": "7",
  "when": 1770940800000,
  "tag": "0002_add_entity_change_notify",
  "breakpoints": true
}
```

**Step 3: Run the migration**

Run: `pnpm db:migrate`
Expected: "migrations applied successfully"

**Step 4: Verify the trigger works**

Run:
```bash
docker exec baker-street-tasks-postgres-1 psql -U baker -d baker_street_tasks -c "
  LISTEN entity_change;
  INSERT INTO tasks (id, title, status, priority, order_index, created_by)
    VALUES (gen_random_uuid(), 'trigger test', 'Inbox', 'P3', 'zz', 'test');
"
```
Expected: Output includes `Asynchronous notification "entity_change" received` with JSON payload containing `"table":"tasks","op":"INSERT"`.

Note: `psql` in non-interactive mode may not show LISTEN output. An alternative verification:

```bash
docker exec baker-street-tasks-postgres-1 psql -U baker -d baker_street_tasks -c "
  SELECT tgname, tgrelid::regclass, tgenabled FROM pg_trigger WHERE tgname LIKE '%entity_change%';
"
```
Expected: 3 rows for tasks, subtasks, captures triggers, all enabled.

**Step 5: Clean up test row**

```bash
docker exec baker-street-tasks-postgres-1 psql -U baker -d baker_street_tasks -c "
  DELETE FROM tasks WHERE title = 'trigger test';
"
```

**Step 6: Commit**

```bash
git add packages/db/drizzle/0002_add_entity_change_notify.sql packages/db/drizzle/meta/_journal.json
git commit -m "feat: add Postgres NOTIFY triggers for real-time entity changes"
```

---

### Task 2: SSE Route Handler

**Files:**
- Create: `apps/web/src/app/api/events/route.ts`

**Step 1: Write the SSE endpoint**

Create `apps/web/src/app/api/events/route.ts`:

```typescript
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return new Response("DATABASE_URL not set", { status: 500 });
  }

  // Dedicated connection for LISTEN (not from pool)
  const sql = postgres(url, { max: 1 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);

      // Subscribe to entity changes
      await sql.listen("entity_change", (payload) => {
        send(payload);
      });

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        sql.end().catch(() => {});
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Step 2: Verify the endpoint starts**

The dev server should auto-reload. Run:
```bash
curl -N http://localhost:3000/api/events &
CURL_PID=$!
sleep 2
```
Expected: Connection stays open, no errors.

Then trigger a change:
```bash
docker exec baker-street-tasks-postgres-1 psql -U baker -d baker_street_tasks -c "
  UPDATE tasks SET title = title WHERE id = (SELECT id FROM tasks LIMIT 1);
"
```
Expected: The curl output shows `data: {"table":"tasks","op":"UPDATE","id":"..."}`.

Clean up: `kill $CURL_PID`

**Step 3: Commit**

```bash
git add apps/web/src/app/api/events/route.ts
git commit -m "feat: add SSE endpoint for real-time entity change events"
```

---

### Task 3: Client Hook + Shell Integration

**Files:**
- Create: `apps/web/src/hooks/use-realtime-refresh.ts`
- Create: `apps/web/src/components/shell/realtime-refresh.tsx`
- Modify: `apps/web/src/app/(shell)/layout.tsx`

**Step 1: Write the hook**

Create `apps/web/src/hooks/use-realtime-refresh.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useRealtimeRefresh() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onmessage = () => {
      // Debounce rapid events (e.g. bulk updates) — 500ms window
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.refresh();
      }, 500);
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do
    };

    return () => {
      es.close();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [router]);
}
```

**Step 2: Write the wrapper component**

Create `apps/web/src/components/shell/realtime-refresh.tsx`:

```typescript
"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export function RealtimeRefresh() {
  useRealtimeRefresh();
  return null;
}
```

**Step 3: Mount in shell layout**

Modify `apps/web/src/app/(shell)/layout.tsx` — add the import and render `<RealtimeRefresh />` inside the layout:

Current:
```typescript
import { ShellLayout } from "@/components/shell/shell-layout";
import { getSavedViews, getTags } from "@/lib/api/views";
```

After:
```typescript
import { ShellLayout } from "@/components/shell/shell-layout";
import { RealtimeRefresh } from "@/components/shell/realtime-refresh";
import { getSavedViews, getTags } from "@/lib/api/views";
```

Current return:
```typescript
  return (
    <ShellLayout savedViews={savedViews} tags={tags}>
      {children}
    </ShellLayout>
  );
```

After:
```typescript
  return (
    <ShellLayout savedViews={savedViews} tags={tags}>
      <RealtimeRefresh />
      {children}
    </ShellLayout>
  );
```

**Step 4: Commit**

```bash
git add apps/web/src/hooks/use-realtime-refresh.ts apps/web/src/components/shell/realtime-refresh.tsx apps/web/src/app/\(shell\)/layout.tsx
git commit -m "feat: add real-time refresh hook and mount in shell layout"
```

---

### Task 4: End-to-End Verification

**Step 1: Open the UI in a browser**

Navigate to `http://localhost:3000` — you should see the dashboard with existing tasks.

**Step 2: Create a task via MCP**

Using curl (initialize session first, then call `tasks.create`):

```bash
# Initialize
RESP=$(curl -s -D - -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}')

SESSION=$(echo "$RESP" | grep -i mcp-session-id | awk '{print $2}' | tr -d '\r')

# Create task
curl -s -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"tasks.create","arguments":{"title":"Real-time test task","status":"Active"}}}'
```

**Step 3: Verify UI updates without manual refresh**

Expected: The task "Real-time test task" appears in the UI within ~1 second, without clicking refresh or reloading the page.

**Step 4: Clean up test data**

Delete the test tasks created during verification:
```bash
docker exec baker-street-tasks-postgres-1 psql -U baker -d baker_street_tasks -c "
  DELETE FROM tasks WHERE title IN ('Real-time test task', 'Debug test - added via MCP at 3:22pm');
"
```

**Step 5: Final commit**

No code changes here — this task is verification only.
