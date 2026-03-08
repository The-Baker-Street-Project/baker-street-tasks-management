# Extension Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Register the MCP server as a Baker Street platform extension via NATS announce/heartbeat so the Brain auto-discovers all 34 task management tools.

**Architecture:** Add a `nats` dependency and a new `extension.ts` module that connects to NATS on startup, publishes an `ExtensionAnnounce` message, and heartbeats every 30s. Feature-gated by `NATS_URL` env var — if unset, extension registration is skipped. K8s manifest deploys the server into the `bakerst` namespace with correct labels for network policies.

**Tech Stack:** nats.js, Express 5, MCP SDK, Kubernetes YAML

**Design doc:** `docs/plans/2026-02-23-extension-registration-design.md`

---

### Task 1: Add nats dependency

**Files:**
- Modify: `packages/mcp-server/package.json`

**Step 1: Add nats to dependencies**

In `packages/mcp-server/package.json`, add to the `"dependencies"` object:

```json
    "nats": "^2.29.0"
```

**Step 2: Install**

Run: `pnpm install`
Expected: Resolves and installs nats package successfully.

**Step 3: Commit**

```bash
git add packages/mcp-server/package.json pnpm-lock.yaml
git commit -m "chore(mcp-server): add nats dependency for extension registration"
```

---

### Task 2: Create extension.ts — NATS announce + heartbeat

**Files:**
- Create: `packages/mcp-server/src/extension.ts`

**Step 1: Create the extension module**

Create `packages/mcp-server/src/extension.ts`:

```typescript
import { connect, NatsConnection, StringCodec } from "nats";

// ── NATS subjects (must match Baker Street platform) ────────────────

const EXTENSION_ANNOUNCE = "bakerst.extensions.announce";
const extensionHeartbeat = (id: string) => `bakerst.extensions.${id}.heartbeat`;

// ── Extension metadata ──────────────────────────────────────────────

const EXTENSION_ID = "baker-street-tasks";

const TOOLS = [
  "tasks.create", "tasks.get", "tasks.list", "tasks.update",
  "tasks.complete", "tasks.reopen", "tasks.search", "tasks.move_status",
  "tasks.bulk_update",
  "subtasks.add", "subtasks.toggle", "subtasks.reorder",
  "captures.create", "captures.get", "captures.update", "captures.pin",
  "captures.unpin", "captures.review", "captures.archive",
  "captures.promote_to_task", "captures.extract_tasks",
  "tags.list", "tags.create", "tags.rename", "tags.merge",
  "views.list", "views.create", "views.update",
  "audit.list", "audit.get",
  "undo.last_ai_action", "undo.by_id",
  "system.health", "system.capabilities",
];

// ── State ───────────────────────────────────────────────────────────

let nc: NatsConnection | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let startTime: number = 0;

const sc = StringCodec();

// ── Public API ──────────────────────────────────────────────────────

/**
 * Start extension registration. Connects to NATS, publishes announce,
 * and begins heartbeat loop. No-op if NATS_URL is not set.
 */
export async function startExtension(): Promise<void> {
  const natsUrl = process.env.NATS_URL;
  if (!natsUrl) return;

  const mcpUrl =
    process.env.EXTENSION_MCP_URL ??
    `http://ext-${EXTENSION_ID}.bakerst.svc.cluster.local:8080/mcp`;

  try {
    nc = await connect({ servers: natsUrl });
    startTime = Date.now();

    // Announce
    const announce = {
      id: EXTENSION_ID,
      name: "Baker Street Tasks",
      version: "0.1.0",
      description:
        "Task management — create, update, search, and organize tasks and captures",
      mcpUrl,
      transport: "streamable-http",
      tools: TOOLS,
      tags: ["tasks", "captures", "productivity"],
    };

    nc.publish(EXTENSION_ANNOUNCE, sc.encode(JSON.stringify(announce)));
    console.log(`Extension announced on NATS as "${EXTENSION_ID}"`);

    // Heartbeat every 30s
    heartbeatTimer = setInterval(() => {
      if (!nc || nc.isClosed()) return;
      const heartbeat = {
        id: EXTENSION_ID,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        activeRequests: 0,
      };
      nc.publish(
        extensionHeartbeat(EXTENSION_ID),
        sc.encode(JSON.stringify(heartbeat)),
      );
    }, 30_000);

    console.log("Extension heartbeat started (every 30s)");
  } catch (err) {
    console.error("Failed to connect to NATS for extension registration:", err);
    console.error("Extension registration disabled — MCP server continues without it.");
  }
}

/**
 * Stop extension registration. Clears heartbeat timer and drains NATS.
 */
export async function stopExtension(): Promise<void> {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (nc && !nc.isClosed()) {
    await nc.drain();
    nc = null;
  }
}
```

**Step 2: Type check**

Run: `cd packages/mcp-server && pnpm exec tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add packages/mcp-server/src/extension.ts
git commit -m "feat(mcp-server): add NATS extension announce and heartbeat"
```

---

### Task 3: Integrate extension into server.ts

**Files:**
- Modify: `packages/mcp-server/src/server.ts`

**Step 1: Add imports**

At the top of `packages/mcp-server/src/server.ts`, after the existing imports, add:

```typescript
import { startExtension, stopExtension } from "./extension";
```

**Step 2: Start extension after listen**

In the `isMainModule` block, after the `app.listen()` callback, start the extension. Replace the entire `if (isMainModule)` block:

```typescript
if (isMainModule) {
  const PORT = parseInt(process.env.PORT ?? process.env.MCP_PORT ?? "3100", 10);
  app.listen(PORT, async () => {
    console.log(`Baker Street Tasks MCP server listening on port ${PORT}`);
    console.log(`  POST/GET/DELETE /mcp  — MCP Streamable HTTP transport`);
    console.log(`  GET /health           — health check`);
    await startExtension();
  });

  // Graceful shutdown
  const shutdown = async () => {
    await stopExtension();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
```

**Step 3: Export startExtension/stopExtension for unified server**

Also re-export from the module so the unified `apps/web/server.ts` can call them too. Add after the `export const app` line:

```typescript
export { startExtension, stopExtension } from "./extension";
```

**Step 4: Type check**

Run: `cd packages/mcp-server && pnpm exec tsc --noEmit`
Expected: No errors.

**Step 5: Build**

Run: `pnpm build`
Expected: All packages build successfully.

**Step 6: Commit**

```bash
git add packages/mcp-server/src/server.ts
git commit -m "feat(mcp-server): integrate extension registration into server lifecycle"
```

---

### Task 4: Create K8s extension manifest

**Files:**
- Create: `k8s/extension.yaml`

**Step 1: Create the manifest**

Create `k8s/extension.yaml`:

```yaml
# Baker Street Tasks as a Baker Street platform extension.
# Deploy to the bakerst namespace so the Brain can discover it.
#
# Prerequisites:
#   - Baker Street platform running in bakerst namespace
#   - NATS accessible at nats.bakerst.svc.cluster.local:4222
#   - Image built: docker build -f apps/web/Dockerfile -t baker-street-tasks:latest .
#
# Usage:
#   kubectl apply -f k8s/extension.yaml
#   kubectl -n bakerst logs deployment/ext-baker-street-tasks -f
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ext-baker-street-tasks
  namespace: bakerst
  labels:
    app: bakerst-extension
    extension: baker-street-tasks
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: bakerst-extension
      extension: baker-street-tasks
  template:
    metadata:
      labels:
        app: bakerst-extension
        extension: baker-street-tasks
    spec:
      containers:
        - name: baker-street-tasks
          image: baker-street-tasks:latest
          imagePullPolicy: IfNotPresent
          ports:
            - name: mcp
              containerPort: 8080
          env:
            - name: MCP_PORT
              value: "8080"
            - name: PORT
              value: "8080"
            - name: NATS_URL
              value: nats://nats.bakerst.svc.cluster.local:4222
            - name: EXTENSION_MCP_URL
              value: http://ext-baker-street-tasks.bakerst.svc.cluster.local:8080/mcp
            - name: PGLITE_DATA_DIR
              value: /data/pglite
            - name: MCP_API_KEY
              valueFrom:
                secretKeyRef:
                  name: baker-street-tasks-secrets
                  key: MCP_API_KEY
          volumeMounts:
            - name: pglite-data
              mountPath: /data/pglite
            - name: tmp
              mountPath: /tmp
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests:
              memory: 128Mi
              cpu: 50m
            limits:
              memory: 256Mi
              cpu: 200m
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
            seccompProfile:
              type: RuntimeDefault
      volumes:
        - name: pglite-data
          persistentVolumeClaim:
            claimName: baker-street-tasks-pglite
        - name: tmp
          emptyDir: {}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: baker-street-tasks-pglite
  namespace: bakerst
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: ext-baker-street-tasks
  namespace: bakerst
spec:
  selector:
    app: bakerst-extension
    extension: baker-street-tasks
  ports:
    - name: mcp
      port: 8080
      targetPort: 8080
---
apiVersion: v1
kind: Secret
metadata:
  name: baker-street-tasks-secrets
  namespace: bakerst
type: Opaque
stringData:
  MCP_API_KEY: REPLACE_ME_WITH_REAL_KEY
```

**Step 2: Commit**

```bash
git add k8s/extension.yaml
git commit -m "feat: add K8s manifest for bakerst extension deployment"
```

---

### Task 5: Update env and docs

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

**Step 1: Add env vars to .env.example**

Add after the existing variables in `.env.example`:

```
# Extension registration (optional — connects to Baker Street platform)
# NATS_URL=nats://nats.bakerst.svc.cluster.local:4222
# EXTENSION_MCP_URL=http://ext-baker-street-tasks.bakerst.svc.cluster.local:8080/mcp
```

**Step 2: Update CLAUDE.md Environment section**

Add to the `## Environment` section in `CLAUDE.md`, after the existing env vars:

```markdown
- `NATS_URL` — (optional) NATS server URL for Baker Street extension registration. If unset, extension registration is disabled
- `EXTENSION_MCP_URL` — (optional) MCP URL the Brain uses to reach this server (default: K8s service URL)
```

**Step 3: Add extension info to CLAUDE.md**

Add a new section after `## Deployment (K8s)`:

```markdown
## Baker Street Extension

The MCP server can register as a Baker Street platform extension. When `NATS_URL` is set, it announces itself on NATS and heartbeats every 30s. The Brain auto-discovers all 34 task management tools.

Deploy to the `bakerst` namespace:
```bash
kubectl apply -f k8s/extension.yaml
```
```

**Step 4: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: add extension registration env vars and documentation"
```
