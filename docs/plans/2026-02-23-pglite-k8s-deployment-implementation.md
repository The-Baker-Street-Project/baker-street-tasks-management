# PGlite + K8s Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace PostgreSQL with PGlite and deploy as a single Kubernetes pod on local k3s.

**Architecture:** Single container running a unified Node.js process that serves both Next.js (:3000) and MCP Express (:3100), sharing one in-process PGlite database. K8s manifests in plain YAML targeting k3s with local-path storage.

**Tech Stack:** PGlite (`@electric-sql/pglite`), Drizzle ORM (pglite driver), Next.js 15, Express 5, k3s, plain K8s YAML manifests.

**Design doc:** `docs/plans/2026-02-23-pglite-k8s-deployment-design.md`

---

## Team DB — Core PGlite Swap (`packages/db`)

### Task 1: Swap postgres driver for PGlite in package.json

**Files:**
- Modify: `packages/db/package.json`

**Step 1: Update dependencies**

In `packages/db/package.json`, replace the `postgres` dependency with `@electric-sql/pglite`:

```json
  "dependencies": {
    "drizzle-orm": "^0.45.0",
    "@electric-sql/pglite": "^0.2.0",
    "fractional-indexing": "^3.2.0"
  },
```

Remove the `"postgres": "^3.4.0"` line entirely.

**Step 2: Install**

Run: `pnpm install`

**Step 3: Commit**

```bash
git add packages/db/package.json pnpm-lock.yaml
git commit -m "chore(db): swap postgres driver for @electric-sql/pglite"
```

---

### Task 2: Rewrite client.ts to use PGlite driver

**Files:**
- Modify: `packages/db/src/client.ts`

**Step 1: Replace client.ts contents**

Replace the entire file with:

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

**Step 2: Build**

Run: `cd packages/db && pnpm exec tsc --noEmit`
Expected: Success (no output)

**Step 3: Commit**

```bash
git add packages/db/src/client.ts
git commit -m "feat(db): rewrite client.ts to use PGlite driver"
```

---

### Task 3: Export getPgliteClient from index.ts

**Files:**
- Modify: `packages/db/src/index.ts`

**Step 1: Update exports**

Replace the entire file with:

```typescript
export * from "./schema/index";
export { createDb, getPgliteClient, type Database } from "./client";
```

**Step 2: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): export getPgliteClient from package index"
```

---

### Task 4: Create programmatic migration helper

**Files:**
- Create: `packages/db/src/migrate.ts`
- Modify: `packages/db/package.json` (add export)

**Step 1: Create migrate.ts**

Create the file `packages/db/src/migrate.ts`:

```typescript
import { migrate } from "drizzle-orm/pglite/migrator";
import { createDb } from "./client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(dataDir?: string) {
  const db = createDb(dataDir);
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../drizzle"),
  });
}
```

**Step 2: Add export to package.json**

In `packages/db/package.json`, update the `"exports"` field:

```json
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./schema": "./src/schema/index.ts",
    "./queries": "./src/queries/index.ts",
    "./migrate": "./src/migrate.ts"
  },
```

**Step 3: Build**

Run: `cd packages/db && pnpm exec tsc --noEmit`
Expected: Success

**Step 4: Commit**

```bash
git add packages/db/src/migrate.ts packages/db/package.json
git commit -m "feat(db): add programmatic migration helper for PGlite"
```

---

### Task 5: Update drizzle.config.ts

**Files:**
- Modify: `packages/db/drizzle.config.ts`

**Step 1: Update config**

Replace the entire file with:

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

**Step 2: Commit**

```bash
git add packages/db/drizzle.config.ts
git commit -m "chore(db): update drizzle.config.ts for PGlite driver"
```

---

### Task 6: Update seed.ts to close PGlite before exit

**Files:**
- Modify: `packages/db/src/seed.ts`

**Step 1: Update seed.ts**

Replace the entire file with:

```typescript
import { createDb, getPgliteClient } from "./client";
import { savedViews } from "./schema/views";
import { eq } from "drizzle-orm";

async function seed() {
  const db = createDb();

  console.log("Seeding system views...");

  // Clear existing system views to ensure idempotency
  await db.delete(savedViews).where(eq(savedViews.isSystem, true));

  await db.insert(savedViews).values([
    {
      name: "All Tasks",
      type: "Tasks",
      isSystem: true,
      sortOrder: 0,
      filterDefinition: { status: ["Inbox", "Active", "Someday"] },
    },
    {
      name: "Inbox",
      type: "Tasks",
      isSystem: true,
      sortOrder: 1,
      filterDefinition: { status: ["Inbox"] },
    },
    {
      name: "Active",
      type: "Tasks",
      isSystem: true,
      sortOrder: 2,
      filterDefinition: { status: ["Active"] },
    },
    {
      name: "All Captures",
      type: "Captures",
      isSystem: true,
      sortOrder: 0,
      filterDefinition: { status: ["Captured", "Reviewed"] },
    },
  ]);

  console.log("Seed complete.");

  // Close PGlite to flush writes before exit
  await getPgliteClient().close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await getPgliteClient().close();
  } catch {}
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "fix(db): close PGlite before process.exit in seed"
```

---

## Team Web — Web App + Unified Server

### Task 7: Remove postgres dep from web, add PGlite externals

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.ts`

**Step 1: Remove postgres from apps/web/package.json**

In `apps/web/package.json`, remove the `"postgres": "^3.4.0"` line from `dependencies`.

**Step 2: Update next.config.ts**

Replace the entire file with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@baker-street/db"],
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
```

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/next.config.ts
git commit -m "chore(web): remove postgres dep, add PGlite server externals"
```

---

### Task 8: Rewrite SSE events route for PGlite

**Files:**
- Modify: `apps/web/src/app/api/events/route.ts`

**Step 1: Replace the SSE route**

Replace the entire file with:

```typescript
import { getPgliteClient } from "@baker-street/db/client";

export const dynamic = "force-dynamic";

type Listener = (payload: string) => void;
const listeners = new Set<Listener>();
let listenerReady: Promise<void> | null = null;

function ensureListener() {
  if (listenerReady) return listenerReady;
  const pg = getPgliteClient();
  listenerReady = pg
    .listen("entity_change", (payload) => {
      for (const fn of listeners) {
        fn(payload);
      }
    })
    .then(() => {});
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

**Step 2: Commit**

```bash
git add apps/web/src/app/api/events/route.ts
git commit -m "feat(web): rewrite SSE events route for PGlite LISTEN/NOTIFY"
```

---

### Task 9: Export MCP Express app from mcp-server package

**Files:**
- Modify: `packages/mcp-server/src/server.ts`
- Modify: `packages/mcp-server/package.json`

**Step 1: Refactor server.ts to export the app**

Replace the entire file with:

```typescript
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createDb } from "@baker-street/db/client";
import { authMiddleware } from "./middleware/auth";
import { mcpRateLimiter } from "./middleware/rate-limit";
import { registerAllTools } from "./tools/index";

// ── database ────────────────────────────────────────────────────────

const db = createDb();

// ── MCP server ──────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "baker-street-tasks",
    version: "0.1.0",
  });

  registerAllTools(server, db);

  return server;
}

// ── Express app ─────────────────────────────────────────────────────

export const app = express();

// Health endpoint — no auth required
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Apply auth and rate limiting to all /mcp routes
app.use("/mcp", authMiddleware, mcpRateLimiter);

// Map of session ID to MCP server + transport
const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

// ─── POST /mcp ──────────────────────────────────────────────────────
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    return;
  }

  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, { server, transport });
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      sessions.delete(sid);
    }
  };

  await server.connect(transport);
  await transport.handleRequest(req, res);
});

// ─── GET /mcp ───────────────────────────────────────────────────────
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID. POST to /mcp first." });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
});

// ─── DELETE /mcp ────────────────────────────────────────────────────
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
  sessions.delete(sessionId);
});

// ── standalone start (when run directly) ────────────────────────────

const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("/server.js") || process.argv[1].endsWith("/server.ts"));

if (isMainModule) {
  const PORT = parseInt(process.env.PORT ?? process.env.MCP_PORT ?? "3100", 10);
  app.listen(PORT, () => {
    console.log(`Baker Street Tasks MCP server listening on port ${PORT}`);
    console.log(`  POST/GET/DELETE /mcp  — MCP Streamable HTTP transport`);
    console.log(`  GET /health           — health check`);
  });
}
```

Key change: `app` is now exported as a named export, and the `listen()` call only runs when the file is executed directly (not when imported by the unified server).

**Step 2: Remove postgres from mcp-server/package.json**

In `packages/mcp-server/package.json`, remove the `"postgres": "^3.4.0"` line from `dependencies`.

**Step 3: Add exports to mcp-server/package.json**

Add an `"exports"` field to `packages/mcp-server/package.json`:

```json
  "exports": {
    ".": "./src/server.ts",
    "./app": "./src/server.ts"
  },
```

**Step 4: Install**

Run: `pnpm install`

**Step 5: Commit**

```bash
git add packages/mcp-server/src/server.ts packages/mcp-server/package.json pnpm-lock.yaml
git commit -m "feat(mcp-server): export Express app, remove postgres dep"
```

---

### Task 10: Create unified server.ts entrypoint

**Files:**
- Create: `apps/web/server.ts`

**Step 1: Create the unified server**

Create `apps/web/server.ts`:

```typescript
import next from "next";
import { createServer } from "http";
import { parse } from "url";
import { runMigrations } from "@baker-street/db/migrate";
import { createDb } from "@baker-street/db/client";
import { app as mcpApp } from "@baker-street/mcp-server/app";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const webPort = parseInt(process.env.PORT ?? "3000", 10);
const mcpPort = parseInt(process.env.MCP_PORT ?? "3100", 10);

async function main() {
  // 1. Initialize PGlite
  console.log("Initializing PGlite...");
  createDb();

  // 2. Run migrations
  console.log("Running migrations...");
  await runMigrations();

  // 3. Boot Next.js
  const nextApp = next({ dev, hostname, port: webPort });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.listen(webPort, hostname, () => {
    console.log(`Next.js ready on http://${hostname}:${webPort}`);
  });

  // 4. Boot MCP server on separate port
  mcpApp.listen(mcpPort, hostname, () => {
    console.log(`MCP server ready on http://${hostname}:${mcpPort}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add apps/web/server.ts
git commit -m "feat(web): add unified server.ts entrypoint for PGlite + MCP"
```

---

### Task 11: Update web Dockerfile for unified server

**Files:**
- Modify: `apps/web/Dockerfile`

**Step 1: Replace the Dockerfile**

Replace `apps/web/Dockerfile` with:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/mcp-server ./packages/mcp-server
COPY apps/web ./apps/web

RUN corepack enable && pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
# PGlite build-time placeholder (not used at build, but needed for module resolution)
ENV PGLITE_DATA_DIR=/tmp/pglite-build
RUN pnpm --filter @baker-street/web build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# Copy MCP server source (imported by unified server)
COPY --from=builder /app/packages/mcp-server ./packages/mcp-server
# Copy DB package including drizzle migrations
COPY --from=builder /app/packages/db ./packages/db
# Copy unified server entrypoint
COPY --from=builder /app/apps/web/server.ts ./apps/web/server.ts

EXPOSE 3000 3100
ENV PORT=3000
ENV MCP_PORT=3100
ENV HOSTNAME=0.0.0.0
ENV PGLITE_DATA_DIR=/data/pglite
CMD ["node", "apps/web/server.js"]
```

**Step 2: Commit**

```bash
git add apps/web/Dockerfile
git commit -m "feat(web): update Dockerfile for unified PGlite server"
```

---

## Team Infra — K8s Manifests + Environment Cleanup

### Task 12: Update .env.example and .gitignore

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`

**Step 1: Update .env.example**

Replace the entire file with:

```
# PGlite data directory
PGLITE_DATA_DIR=./data/pglite

# MCP Server (generate a key with: openssl rand -hex 32)
MCP_API_KEY=
MCP_PORT=3100

# Web App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 2: Update .gitignore**

Add `data/` to the end of `.gitignore`:

```
node_modules/
dist/
.next/
.turbo/
*.tsbuildinfo
.env
.env.local
.env.*.local
.DS_Store
coverage/
*.log
data/
```

**Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: update env for PGlite, add data/ to gitignore"
```

---

### Task 13: Update turbo.json env vars

**Files:**
- Modify: `turbo.json`

**Step 1: Replace turbo.json**

Replace the entire file with:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "passThroughEnv": ["PGLITE_DATA_DIR", "MCP_API_KEY", "MCP_PORT", "NEXT_PUBLIC_APP_URL"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "db:migrate": {
      "cache": false,
      "passThroughEnv": ["PGLITE_DATA_DIR"]
    },
    "db:seed": {
      "cache": false,
      "passThroughEnv": ["PGLITE_DATA_DIR"]
    },
    "db:studio": {
      "cache": false,
      "persistent": true,
      "passThroughEnv": ["PGLITE_DATA_DIR"]
    }
  }
}
```

**Step 2: Commit**

```bash
git add turbo.json
git commit -m "chore: replace DATABASE_URL with PGLITE_DATA_DIR in turbo.json"
```

---

### Task 14: Update dev.sh script

**Files:**
- Modify: `scripts/dev.sh`

**Step 1: Replace dev.sh**

Replace the entire file with:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Load .env
if [ ! -f .env ]; then
  echo "No .env file found. Creating from .env.example..."
  cp .env.example .env
  # Generate an API key
  KEY=$(openssl rand -hex 32)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^MCP_API_KEY=.*/MCP_API_KEY=$KEY/" .env
  else
    sed -i "s/^MCP_API_KEY=.*/MCP_API_KEY=$KEY/" .env
  fi
  echo "Generated MCP_API_KEY in .env"
fi

set -a; source .env; set +a

# Ensure PGlite data directory exists
DATA_DIR="${PGLITE_DATA_DIR:-./data/pglite}"
mkdir -p "$DATA_DIR"
echo "PGlite data directory: $DATA_DIR"

# Install deps if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  pnpm install
fi

# Run migrations
echo "Running migrations..."
pnpm db:migrate

# Seed (idempotent)
echo "Seeding database..."
pnpm db:seed

# Start both services
echo ""
echo "Starting Baker Street Tasks..."
echo "  Web:  http://localhost:3000"
echo "  MCP:  http://localhost:${MCP_PORT:-3100}/mcp"
echo "  Key:  ${MCP_API_KEY:0:8}..."
echo ""

pnpm dev:services
```

**Step 2: Commit**

```bash
git add scripts/dev.sh
git commit -m "chore: remove Docker Postgres from dev.sh, use PGlite data dir"
```

---

### Task 15: Comment out docker-compose.dev.yml, update docker-compose.yml

**Files:**
- Modify: `docker-compose.dev.yml`
- Modify: `docker-compose.yml`

**Step 1: Comment out docker-compose.dev.yml**

Replace the entire file with:

```yaml
# PostgreSQL dev container — replaced by PGlite (in-process).
# Kept for reference in case external Postgres is ever needed again.
#
# services:
#   postgres:
#     image: postgres:17-alpine
#     environment:
#       POSTGRES_USER: baker
#       POSTGRES_PASSWORD: baker_dev
#       POSTGRES_DB: baker_street_tasks
#     ports:
#       - "5432:5432"
#     volumes:
#       - pgdata:/var/lib/postgresql/data
#     healthcheck:
#       test: ["CMD-SHELL", "pg_isready -U baker -d baker_street_tasks"]
#       interval: 5s
#       timeout: 5s
#       retries: 5
#
# volumes:
#   pgdata:
```

**Step 2: Update docker-compose.yml**

Replace the entire file with:

```yaml
services:
  baker-street:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
      - "3100:3100"
    environment:
      PGLITE_DATA_DIR: /data/pglite
      MCP_API_KEY: ${MCP_API_KEY:-dev-api-key-change-me}
      MCP_PORT: 3100
      NEXT_PUBLIC_APP_URL: http://localhost:3000
    volumes:
      - pglite-data:/data/pglite

volumes:
  pglite-data:
```

**Step 3: Commit**

```bash
git add docker-compose.dev.yml docker-compose.yml
git commit -m "chore: update docker-compose for unified PGlite container"
```

---

### Task 16: Create K8s manifests

**Files:**
- Create: `k8s/namespace.yaml`
- Create: `k8s/pvc.yaml`
- Create: `k8s/configmap.yaml`
- Create: `k8s/secret.yaml`
- Create: `k8s/deployment.yaml`
- Create: `k8s/service.yaml`

**Step 1: Create k8s directory**

Run: `mkdir -p k8s`

**Step 2: Create namespace.yaml**

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: baker-street
```

**Step 3: Create pvc.yaml**

Create `k8s/pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pglite-data
  namespace: baker-street
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 1Gi
```

**Step 4: Create configmap.yaml**

Create `k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: baker-street-config
  namespace: baker-street
data:
  PGLITE_DATA_DIR: /data/pglite
  MCP_PORT: "3100"
  NEXT_PUBLIC_APP_URL: http://localhost:3000
```

**Step 5: Create secret.yaml**

Create `k8s/secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: baker-street-secrets
  namespace: baker-street
type: Opaque
stringData:
  # Replace with a real key: openssl rand -hex 32
  MCP_API_KEY: REPLACE_ME_WITH_REAL_KEY
```

**Step 6: Create deployment.yaml**

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: baker-street
  namespace: baker-street
  labels:
    app: baker-street
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: baker-street
  template:
    metadata:
      labels:
        app: baker-street
    spec:
      containers:
        - name: baker-street
          image: baker-street-tasks:latest
          imagePullPolicy: IfNotPresent
          ports:
            - name: web
              containerPort: 3000
            - name: mcp
              containerPort: 3100
          envFrom:
            - configMapRef:
                name: baker-street-config
            - secretRef:
                name: baker-street-secrets
          volumeMounts:
            - name: pglite-data
              mountPath: /data/pglite
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3100
            initialDelaySeconds: 15
            periodSeconds: 30
          resources:
            requests:
              memory: 256Mi
              cpu: 100m
            limits:
              memory: 512Mi
              cpu: 500m
      volumes:
        - name: pglite-data
          persistentVolumeClaim:
            claimName: pglite-data
```

**Step 7: Create service.yaml**

Create `k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: baker-street
  namespace: baker-street
spec:
  type: NodePort
  selector:
    app: baker-street
  ports:
    - name: web
      port: 3000
      targetPort: 3000
    - name: mcp
      port: 3100
      targetPort: 3100
```

**Step 8: Commit**

```bash
git add k8s/
git commit -m "feat: add K8s manifests for single-pod PGlite deployment"
```

---

### Task 17: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the Environment section**

Replace the `## Environment` section with:

```markdown
## Environment

Generated automatically by `scripts/dev.sh` on first run:
- `PGLITE_DATA_DIR` — PGlite data directory (default: `./data/pglite`)
- `MCP_API_KEY` — Bearer token for MCP server auth (auto-generated hex)
- `MCP_PORT` — MCP server port (default: 3100)
- `NEXT_PUBLIC_APP_URL` — Web app URL (default: `http://localhost:3000`)
```

**Step 2: Update the description at the top**

Replace the first line:

```markdown
AI-first single-user task management and capture system. pnpm monorepo with Next.js 15 frontend, Express MCP server, and Drizzle ORM on PGlite (in-process WASM Postgres).
```

**Step 3: Add PGlite gotcha**

Add to the `## Gotchas` section:

```markdown
- **PGlite single-writer**: Only one process can open a PGlite data directory at a time. In dev, web and mcp-server use separate data dirs. In production K8s, a unified server.ts runs both in one process
```

**Step 4: Add K8s deployment section**

Add after the `## Gotchas` section:

```markdown
## Deployment (K8s)

Single-pod deployment on local k3s. Manifests in `k8s/`.

```bash
# Build image
docker build -f apps/web/Dockerfile -t baker-street-tasks:latest .

# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl -n baker-street get pods

# Port-forward for local access
kubectl -n baker-street port-forward svc/baker-street 3000:3000 3100:3100
```
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for PGlite + K8s deployment"
```

---

### Task 18: Remove mcp-server Dockerfile (unified into web Dockerfile)

**Files:**
- Delete: `packages/mcp-server/Dockerfile`

**Step 1: Remove the file**

Run: `rm packages/mcp-server/Dockerfile`

**Step 2: Commit**

```bash
git add packages/mcp-server/Dockerfile
git commit -m "chore: remove standalone mcp-server Dockerfile (unified into web)"
```

---

## Merge Order

1. **Team DB** merges first (Tasks 1-6) — dependency provider
2. **Team Web** merges second (Tasks 7-11) — consumes updated db package
3. **Team Infra** merges last (Tasks 12-18) — config wrapping, K8s manifests

After all merges, run integration test from main:
```bash
pnpm install && pnpm build
```
