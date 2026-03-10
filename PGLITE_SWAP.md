# PGlite Swap: Replace PostgreSQL with In-Process PGlite

## Context

Baker Street Tasks Management currently uses PostgreSQL 17 (Docker container). For lightweight K8s deployment, replace it with **PGlite** — Postgres compiled to WASM that runs in-process in Node.js. This eliminates the external database dependency entirely.

PGlite supports everything this project uses: ENUMs, JSONB, FTS/tsvector, GIN indexes, triggers, LISTEN/NOTIFY, generated columns, UUIDs. Schema files (`drizzle-orm/pg-core`) require **zero changes**.

## Critical Design Decision: Single-Writer Constraint

PGlite can only be opened by **one process at a time**. Currently `apps/web` (Next.js) and `packages/mcp-server` (Express) run as separate processes via `turbo dev`, both calling `createDb()`.

**Approach**: Each process gets its own PGlite data directory in dev (`data/pglite-web` and `data/pglite-mcp`). For production K8s, consolidate into a single container/process. This keeps the swap simple now and defers the architecture consolidation.

---

## Files to Modify (in order)

### Phase 1: Core DB Package

**1. `packages/db/package.json`** — Swap dependencies
- Remove: `postgres`
- Add: `@electric-sql/pglite`

**2. `packages/db/src/client.ts`** — Rewrite driver

Current implementation:
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const clients = new Map<string, ReturnType<typeof drizzle>>();

export function createDb(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  if (clients.has(url)) return clients.get(url)!;
  const client = postgres(url);
  const db = drizzle(client, { schema });
  clients.set(url, db);
  return db;
}

export type Database = ReturnType<typeof createDb>;
```

New implementation:
```typescript
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema/index";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: PGlite | null = null;

export function createDb(dataDir?: string) {
  if (_db) return _db;
  const dir = dataDir ?? process.env.PGLITE_DATA_DIR ?? "./data/pglite";
  _client = new PGlite(dir);
  _db = drizzle({ client: _client, schema });
  return _db;
}

/** Expose the raw PGlite instance for LISTEN/NOTIFY and direct SQL. */
export function getPgliteClient(): PGlite {
  if (!_client) createDb();
  return _client!;
}

export type Database = ReturnType<typeof createDb>;
```

**3. `packages/db/src/index.ts`** — Add `getPgliteClient` export

Current:
```typescript
export * from "./schema/index";
export { createDb, type Database } from "./client";
```

New:
```typescript
export * from "./schema/index";
export { createDb, getPgliteClient, type Database } from "./client";
```

**4. `packages/db/src/migrate.ts`** (new file) — Programmatic migration helper

```typescript
import { migrate } from "drizzle-orm/pglite/migrator";
import { createDb } from "./client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const db = createDb();
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../drizzle"),
  });
}
```

Also add to `packages/db/package.json` exports:
```json
"exports": {
  ".": "./src/index.ts",
  "./client": "./src/client.ts",
  "./schema": "./src/schema/index.ts",
  "./queries": "./src/queries/index.ts",
  "./migrate": "./src/migrate.ts"
}
```

**5. `packages/db/drizzle.config.ts`** — Update config

Current:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

New:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    url: process.env.PGLITE_DATA_DIR || "./data/pglite",
  },
});
```

### Phase 2: SSE + Web App

**6. `apps/web/package.json`** — Remove `postgres` dependency

**7. `apps/web/next.config.ts`** — Add WASM bundling fix

Current:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@baker-street/db"],
};
```

New:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@baker-street/db"],
  serverExternalPackages: ["@electric-sql/pglite"],
};
```

Without `serverExternalPackages`, webpack will fail trying to bundle the WASM binary and Node.js `fs` imports used by PGlite.

**8. `apps/web/src/app/api/events/route.ts`** — Rewrite LISTEN/NOTIFY

Current: Creates a separate `postgres` TCP connection for LISTEN:
```typescript
import postgres from "postgres";

function getNotificationListener() {
  if (!listener) {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    listener = sql;
    sql.listen("entity_changes", (payload: string) => {
      // broadcasts to SSE clients
    });
  }
  return listener;
}
```

New: Use PGlite's in-process `.listen()` API via the shared singleton:
```typescript
import { getPgliteClient } from "@baker-street/db/client";

export const dynamic = "force-dynamic";

type Listener = (payload: string) => void;
const listeners = new Set<Listener>();
let listenerReady: Promise<void> | null = null;

function ensureListener() {
  if (listenerReady) return listenerReady;
  const pg = getPgliteClient();
  listenerReady = pg.listen("entity_change", (payload) => {
    for (const fn of listeners) {
      fn(payload);
    }
  }).then(() => {});
  return listenerReady;
}

export async function GET(request: Request) {
  try {
    await ensureListener();
  } catch {
    return new Response("PGlite not initialized", { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          listeners.delete(send);
        }
      };
      listeners.add(send);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          listeners.delete(send);
        }
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        listeners.delete(send);
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

### Phase 3: MCP Server

**9. `packages/mcp-server/package.json`** — Remove `postgres` dependency. No code changes needed — `server.ts` only imports `createDb()` from `@baker-street/db/client`.

### Phase 4: Environment & Infrastructure

**10. `.env` + `.env.example`** — Replace `DATABASE_URL` with:
```
PGLITE_DATA_DIR=./data/pglite
```

**11. `turbo.json`** — Replace `DATABASE_URL` → `PGLITE_DATA_DIR` in all `passThroughEnv` arrays:
```json
{
  "tasks": {
    "dev": {
      "passThroughEnv": ["PGLITE_DATA_DIR", "MCP_API_KEY", "MCP_PORT", "NEXT_PUBLIC_APP_URL"]
    },
    "db:migrate": {
      "passThroughEnv": ["PGLITE_DATA_DIR"]
    },
    "db:seed": {
      "passThroughEnv": ["PGLITE_DATA_DIR"]
    },
    "db:studio": {
      "passThroughEnv": ["PGLITE_DATA_DIR"]
    }
  }
}
```

**12. `.gitignore`** — Add `data/` directory

**13. `scripts/dev.sh`** — Replace Docker Postgres startup block:

Remove:
```bash
# Start Postgres if not running
if ! docker compose -f docker-compose.dev.yml ps --status running 2>/dev/null | grep -q postgres; then
  echo "Starting Postgres..."
  docker compose -f docker-compose.dev.yml up -d --wait
else
  echo "Postgres already running."
fi
```

Replace with:
```bash
# Ensure PGlite data directory exists
DATA_DIR="${PGLITE_DATA_DIR:-./data/pglite}"
mkdir -p "$DATA_DIR"
echo "PGlite data directory: $DATA_DIR"
```

**14. `docker-compose.dev.yml`** — Comment out postgres service (keep for fallback reference)

**15. `docker-compose.yml`** — Remove postgres service, remove `depends_on`, update volume mounts and env vars

**16. `apps/web/Dockerfile`** — Remove `DATABASE_URL` build-time placeholder, replace with `PGLITE_DATA_DIR`

### Phase 5: Documentation

**17. `CLAUDE.md`** — Update:
- Environment: `DATABASE_URL` → `PGLITE_DATA_DIR`
- Architecture: mention PGlite instead of PostgreSQL
- Gotchas: add "PGlite is single-writer: only one process can open a data directory at a time"

---

## What Does NOT Change

- All schema files (`packages/db/src/schema/*.ts`) — `pg-core` works with PGlite
- All query files (`packages/db/src/queries/*.ts`) — Drizzle query layer unchanged
- All MCP tool files — receive `db` instance, no direct driver imports
- SQL migration files (`drizzle/0000_*.sql`, `0001_*.sql`, `0002_*.sql`) — PGlite executes them as-is
- `packages/db/src/seed.ts` — calls `createDb()`, works transparently

---

## Verification

After each phase, run incrementally:

1. **Phase 1**: `cd packages/db && pnpm install && PGLITE_DATA_DIR=./data/test pnpm db:migrate && pnpm db:seed`
2. **Phase 2**: `cd apps/web && pnpm dev` — dashboard loads, SSE connects, create task triggers real-time update
3. **Phase 3**: `cd packages/mcp-server && pnpm dev` — health check passes, MCP tools work
4. **Phase 4**: From project root: `pnpm dev` — full stack boots without Docker

End-to-end smoke test:
- Create a task via web UI — appears immediately
- Create a task via MCP tool — appears in web UI
- Search tasks (FTS) — results return with tsvector/GIN
- SSE endpoint streams events on entity changes

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Next.js webpack fails on WASM | `serverExternalPackages: ["@electric-sql/pglite"]` |
| PGlite constructor is async | Start with sync `new PGlite(dir)` — it queues ops internally. Refactor to `await PGlite.create(dir)` only if needed |
| Two processes open same data dir | Separate dirs in dev. Single process in prod K8s |
| `seed.ts` calls `process.exit(0)` | May need `getPgliteClient().close()` before exit to flush writes |
| Custom SQL migrations fail | PGlite supports all used features — test the 3 migration files early in Phase 1 |
