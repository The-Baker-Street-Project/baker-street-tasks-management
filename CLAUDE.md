# Baker Street Tasks

AI-first single-user task management system. pnpm monorepo with Next.js 15 frontend, Express MCP server, and Drizzle ORM on PGlite (in-process WASM Postgres).

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `web` | `apps/web` | Next.js 15 App Router frontend (React 19, Tailwind 4, shadcn/ui) |
| `@baker-street/db` | `packages/db` | Drizzle ORM schema, migrations, queries, seed |
| `@baker-street/mcp-server` | `packages/mcp-server` | Express 5 MCP server (25 tools, HTTP transport) |

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Initialize PGlite data dir + run migrations + seed + start all services |
| `pnpm build` | Build all packages via Turbo |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Run `tsc --noEmit` across all packages |
| `pnpm db:migrate` | Run Drizzle migrations |
| `pnpm db:seed` | Seed system views (idempotent) |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |
| `scripts/deploy.sh [standalone\|extension]` | Build Docker image + deploy to k3s (`--skip-build`, `--image TAG`) |

## Architecture

```
apps/web/src/
  app/(shell)/          # All pages behind shell layout (sidebar + nav)
    tasks/              # Task list + detail views
    kanban/             # Kanban board (drag-and-drop)
    search/             # Global search
    settings/           # Settings page
  components/
    ui/                 # shadcn/ui primitives
    shell/              # Layout: sidebar, bottom nav, context toggle
    dashboard/          # Dashboard blocks (overdue, due today, inbox, etc.)
    tasks/              # Task list, row, detail, subtasks
    kanban/             # Board, swimlane, card
    shared/             # Confirm dialog, tag selector
  lib/
    api/                # Server actions ("use server") — all DB access
    queries/            # TanStack Query keys and hooks
    types/              # Canonical TypeScript types (Task, etc.)
packages/db/src/
  schema/               # Drizzle table definitions, enums, relations
  queries/              # Reusable query helpers
  client.ts             # Singleton Drizzle client factory
packages/mcp-server/src/
  tools/                # 25 MCP tools organized by domain
  services/             # Audit logger, idempotency checker
  middleware/           # Auth (bearer token), rate limiting
```

## Key Patterns

- **Server Components first**: Pages fetch data in RSC, pass to client components for interactivity
- **TanStack Query**: Client-side cache with 60s stale time, manual refresh only
- **URL state via nuqs**: Filters (context, tagId, view) stored in URL query params
- **Server actions in `lib/api/`**: All DB access through `"use server"` functions, not API routes
- **Fractional indexing**: `orderIndex` (text field) for drag-and-drop ordering — no renumbering
- **Audit trail**: Every AI action recorded with before/after snapshots in `audit_log`
- **Idempotency**: MCP tools accept `request_id`; duplicates return cached result from audit log
- **Soft deletes**: Status enums (Done/Archived) instead of hard deletes

## Quality Gates

- **Lint and typecheck MUST pass before every commit** — enforced by Husky pre-commit hook
- **All lint warnings and type errors are must-fix** — no `@ts-ignore`, `eslint-disable`, or suppressions without an explanatory comment justifying why
- Warnings in `components/ui/` (shadcn/ui generated code) are exempt
- Pre-commit runs: `pnpm lint` then `pnpm typecheck`

## Code Style

- TypeScript strict mode everywhere
- Canonical types in `apps/web/src/lib/types/index.ts` — use these, not inline types
- `cn()` helper (clsx + tailwind-merge) for conditional classes
- Icons: `lucide-react` only
- Components: shadcn/ui primitives in `components/ui/`, compose into feature components
- Use OKLCH CSS variables for colors (defined in `globals.css`), not hardcoded values

## Environment

Generated automatically by `scripts/dev.sh` on first run:
- `PGLITE_DATA_DIR` — PGlite data directory (default: `./data/pglite`)
- `MCP_API_KEY` — Bearer token for MCP server auth (auto-generated hex)
- `MCP_PORT` — MCP server port (default: 3100)
- `NEXT_PUBLIC_APP_URL` — Web app URL (default: `http://localhost:3000`)
- `NATS_URL` — (optional) NATS server URL for Baker Street extension registration. If unset, extension registration is disabled
- `EXTENSION_MCP_URL` — (optional) MCP URL the Brain uses to reach this server (default: K8s service URL)

## Gotchas

- **Tailwind 4 CSS vars**: Use `[var(--my-var)]` syntax, not bare `[--my-var]` — Tailwind 4 broke the old syntax
- **Seed is destructive for system views**: `db:seed` deletes all system views before re-inserting (intentional for idempotency)
- **Drizzle client singleton**: `createDb()` caches per connection URL — don't create multiple instances
- **MCP sessions**: Each POST to `/mcp` creates a new session with its own transport — no shared global state
- **Dark mode colors**: Always pair light/dark variants (e.g., `border-yellow-300 dark:border-yellow-700`), never use hardcoded light-only colors
- **No auth in v1**: Single API key for everything. No user sessions or login flow yet
- **Subtask auto-complete**: Completing a parent task with incomplete subtasks triggers a warning; on confirm, all subtasks are auto-marked done
- **Virtual scrolling**: TaskList uses `@tanstack/react-virtual`
- **PGlite single-writer**: Only one process can open a PGlite data directory at a time. In dev, web and mcp-server use separate data dirs. In production K8s, a unified server.ts runs both in one process

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

## Baker Street Extension

The MCP server can register as a Baker Street platform extension. When `NATS_URL` is set, it announces itself on NATS and heartbeats every 30s. The Brain auto-discovers all 25 task management tools.

Deploy to the `bakerst` namespace:
```bash
kubectl apply -f k8s/extension.yaml
```

## Reference Docs

- `ai_first_todo_prd_agent_aware_v0_5.md` — Full PRD with acceptance criteria
- `docs/plans/` — Design docs and implementation plans
- `HANDOFF.md` — Session notes and pending work
