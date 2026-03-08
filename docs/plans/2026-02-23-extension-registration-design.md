# Extension Registration Design

## Date: 2026-02-23

## Goal

Register the Baker Street Tasks MCP server as a Baker Street platform extension so the Brain auto-discovers its 34 task management tools via NATS announce/heartbeat.

## Context

The Baker Street platform discovers extensions via a NATS protocol:
1. Extension publishes announce message to `bakerst.extensions.announce` (id, name, mcpUrl, tools)
2. Extension heartbeats every 30s to `bakerst.extensions.<id>.heartbeat`
3. Brain subscribes to announce subject, connects to extension's MCP HTTP endpoint, discovers tools via `tools/list`
4. If 3 heartbeats are missed (90s), Brain marks extension offline and removes tools

The MCP server already serves all 34 tools via Streamable HTTP at `:3100/mcp`. It just needs NATS signaling to be discoverable by the Brain.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SDK vs direct | Direct NATS protocol | SDK creates its own MCP server; we already have one. ~60 lines vs a dependency. |
| Feature gate | `NATS_URL` env var presence | No NATS URL = no extension registration. Dev mode works without NATS. |
| Extension ID | `baker-street-tasks` | Matches service naming convention, becomes `ext-baker-street-tasks` skill in Brain. |

## Architecture

```
MCP Server (existing)
├── Express app on :3100
│   ├── GET /health
│   └── POST/GET/DELETE /mcp  (34 tools via Streamable HTTP)
│
└── Extension registration (new)
    ├── Connect to NATS on startup
    ├── Publish announce (id, name, mcpUrl, tools[])
    ├── Heartbeat every 30s
    └── Drain NATS on shutdown
```

No changes to the MCP server's HTTP handling, tools, auth, or rate limiting. The NATS connection is additive.

## NATS Messages

### Announce (on startup)

Subject: `bakerst.extensions.announce`

```json
{
  "id": "baker-street-tasks",
  "name": "Baker Street Tasks",
  "version": "0.1.0",
  "description": "Task management — create, update, search, and organize tasks and captures",
  "mcpUrl": "http://ext-baker-street-tasks.bakerst.svc.cluster.local:8080/mcp",
  "transport": "streamable-http",
  "tools": [
    "tasks.create", "tasks.get", "tasks.list", "tasks.update",
    "tasks.complete", "tasks.reopen", "tasks.search", "tasks.move_status",
    "tasks.bulk_update", "subtasks.add", "subtasks.toggle", "subtasks.reorder",
    "captures.create", "captures.get", "captures.update", "captures.pin",
    "captures.unpin", "captures.review", "captures.archive",
    "captures.promote_to_task", "captures.extract_tasks",
    "tags.list", "tags.create", "tags.rename", "tags.merge",
    "views.list", "views.create", "views.update",
    "audit.list", "audit.get",
    "undo.last_ai_action", "undo.by_id",
    "system.health", "system.capabilities"
  ],
  "tags": ["tasks", "captures", "productivity"]
}
```

### Heartbeat (every 30s)

Subject: `bakerst.extensions.baker-street-tasks.heartbeat`

```json
{
  "id": "baker-street-tasks",
  "timestamp": "2026-02-23T10:30:00Z",
  "uptime": 3600000,
  "activeRequests": 0
}
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `packages/mcp-server/package.json` | Modify | Add `nats` dependency |
| `packages/mcp-server/src/extension.ts` | Create | NATS announce + heartbeat logic |
| `packages/mcp-server/src/server.ts` | Modify | Call `startExtension()` after listen, `stopExtension()` on shutdown |
| `k8s/extension.yaml` | Create | Deployment + Service for bakerst namespace |
| `.env.example` | Modify | Add `NATS_URL`, `EXTENSION_MCP_URL` |
| `CLAUDE.md` | Modify | Document extension env vars |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NATS_URL` | (none — feature disabled) | NATS server URL, e.g., `nats://nats.bakerst.svc.cluster.local:4222` |
| `EXTENSION_MCP_URL` | `http://ext-baker-street-tasks.bakerst.svc.cluster.local:8080/mcp` | MCP URL that Brain uses to reach this server |

## K8s Manifest

Deployment + Service in `bakerst` namespace:
- Labels: `app: bakerst-extension`, `extension: baker-street-tasks` (required for network policies)
- Container port: 8080 (standard extension port)
- Service: `ext-baker-street-tasks` on port 8080
- Env: `NATS_URL`, `EXTENSION_MCP_URL`, `MCP_API_KEY`, `PGLITE_DATA_DIR`
- Probes: liveness + readiness on `/health`
- Security: non-root, read-only FS, drop all caps, seccomp

## What Does NOT Change

- All 34 MCP tools — zero modifications
- Express HTTP handling, auth middleware, rate limiting
- Session management, MCP transport
- PGlite database, schema, migrations
- Web app, unified server entrypoint
