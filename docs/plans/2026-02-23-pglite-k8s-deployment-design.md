# PGlite Swap + Kubernetes Deployment Design

## Date: 2026-02-23

## Goal

Replace PostgreSQL (Docker container) with PGlite (in-process WASM Postgres) and deploy Baker Street Tasks as a single Kubernetes pod on local k3s/microk8s. Eliminates the external database dependency entirely.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database engine | PGlite (`@electric-sql/pglite`) | In-process, zero external deps, PGLITE_SWAP.md validated compatibility |
| K8s target | Local k3s/microk8s on Sherlock | Homelab deployment alongside existing Docker stacks |
| Pod layout | Single pod, single container | PGlite is single-writer; unified process avoids data split |
| Process model | Unified Node.js process | One `server.ts` runs both Next.js (:3000) and MCP Express (:3100) |
| MCP routing | Separate port :3100 | No URL changes for MCP clients, simpler than subpath routing |
| Manifest format | Plain YAML in `k8s/` directory | Simple, kubectl-friendly, no templating overhead |
| Scaling | Single replica only | PGlite single-writer constraint, no horizontal scaling |

## Architecture

```
K8s Pod: baker-street
┌─────────────────────────────────────────────────┐
│ Container: baker-street                         │
│                                                 │
│   server.ts (unified entrypoint)                │
│   ├── createDb()  → PGlite singleton            │
│   ├── Next.js     → :3000 (web UI)              │
│   └── MCP Express → :3100 (MCP tools)           │
│                                                 │
│   Volume mount: /data/pglite (PVC)              │
└─────────────────────────────────────────────────┘
         │              │
    Service:3000   Service:3100
```

Both Next.js and MCP Express share the same in-process PGlite instance via the `@baker-street/db` singleton. The module cache ensures `createDb()` returns the same instance regardless of which code path calls it.

## Unified Server Entrypoint

New file: `apps/web/server.ts`

1. Calls `createDb()` from `@baker-street/db` — initializes PGlite singleton
2. Runs programmatic migrations via `runMigrations()` from `@baker-street/db/migrate`
3. Boots Next.js via `next()` programmatic API, listens on port 3000
4. Imports MCP Express app from `@baker-street/mcp-server`, listens on port 3100
5. Both services share the same PGlite instance through Node.js module caching

## K8s Manifests

Directory: `k8s/`

| File | Resource | Details |
|------|----------|---------|
| `namespace.yaml` | Namespace | `baker-street` |
| `pvc.yaml` | PersistentVolumeClaim | 1Gi, `ReadWriteOnce`, `local-path` storage class |
| `configmap.yaml` | ConfigMap | `PGLITE_DATA_DIR=/data/pglite`, `MCP_PORT=3100`, `NEXT_PUBLIC_APP_URL` |
| `secret.yaml` | Secret | `MCP_API_KEY` (placeholder — real value applied manually) |
| `deployment.yaml` | Deployment | 1 replica, mounts PVC at `/data/pglite`, probes on :3000 and :3100 |
| `service.yaml` | Service | ClusterIP, ports 3000 + 3100 |

### Probes

- **Readiness**: HTTP GET `:3000` (Next.js) — pod receives traffic only when app is ready
- **Liveness**: HTTP GET `:3100/health` (MCP health endpoint) — restarts if process hangs

## PGlite Integration (from PGLITE_SWAP.md)

### packages/db changes
- Swap `postgres` driver → `@electric-sql/pglite`
- Swap `drizzle-orm/postgres-js` → `drizzle-orm/pglite`
- New `getPgliteClient()` export for LISTEN/NOTIFY
- New `migrate.ts` for programmatic migrations
- Update `drizzle.config.ts` with `driver: "pglite"`

### apps/web changes
- Remove `postgres` dependency
- Add `serverExternalPackages: ["@electric-sql/pglite"]` to next.config.ts
- Rewrite `api/events/route.ts` to use `getPgliteClient()` for LISTEN/NOTIFY
- New unified `server.ts` entrypoint
- Updated Dockerfile for single-container build

### packages/mcp-server changes
- Remove `postgres` dependency (uses `@baker-street/db` which now provides PGlite)
- No code changes — `createDb()` API is unchanged
- MCP server app exported for import by unified server

### Infrastructure changes
- `.env.example`: `DATABASE_URL` → `PGLITE_DATA_DIR`
- `turbo.json`: `DATABASE_URL` → `PGLITE_DATA_DIR` in all `passThroughEnv`
- `scripts/dev.sh`: Remove Docker Postgres startup, add PGlite data dir creation
- `docker-compose.dev.yml`: Comment out postgres service
- `docker-compose.yml`: Replace multi-service with single unified service
- `.gitignore`: Add `data/`
- `CLAUDE.md`: Update environment docs, architecture notes, gotchas

## Team Split

Three teams with clear file ownership, no overlap:

### Team DB — Core PGlite swap (`packages/db`)
Files: `packages/db/package.json`, `src/client.ts`, `src/index.ts`, `src/migrate.ts` (new), `drizzle.config.ts`

### Team Web — Web app + unified server (`apps/web`, `packages/mcp-server`)
Files: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/server.ts` (new), `apps/web/Dockerfile`, `apps/web/src/app/api/events/route.ts`, `packages/mcp-server/package.json`, `packages/mcp-server/src/server.ts` (export app)

### Team Infra — K8s manifests + environment cleanup
Files: `k8s/` (all new), `.env.example`, `.gitignore`, `turbo.json`, `scripts/dev.sh`, `docker-compose.yml`, `docker-compose.dev.yml`, `CLAUDE.md`

### Merge Order
1. **Team DB** first — dependency provider, all other teams consume `@baker-street/db`
2. **Team Web** second — consumes updated db package, builds unified server
3. **Team Infra** last — wraps everything in K8s manifests, updates config

## What Does NOT Change

- All schema files (`packages/db/src/schema/*.ts`) — `pg-core` works with PGlite
- All query files (`packages/db/src/queries/*.ts`) — Drizzle query layer unchanged
- All MCP tool files — receive `db` instance, no direct driver imports
- SQL migration files — PGlite executes them as-is
- `packages/db/src/seed.ts` — calls `createDb()`, works transparently

## Risks

| Risk | Mitigation |
|------|------------|
| Next.js webpack bundles PGlite WASM incorrectly | `serverExternalPackages: ["@electric-sql/pglite"]` |
| Unified server complexity | Simple: two `listen()` calls on different ports, shared DB singleton |
| PGlite single-writer prevents scaling | Acceptable for single-user app; document as constraint |
| k3s local-path PVC data loss on node failure | Acceptable for homelab; can add backup CronJob later |
| MCP server module import from unified server | Export Express app from mcp-server package entry point |
