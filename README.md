# Baker Street Tasks

[![CI](https://github.com/The-Baker-Street-Project/baker-street-tasks-management/actions/workflows/ci.yml/badge.svg)](https://github.com/The-Baker-Street-Project/baker-street-tasks-management/actions/workflows/ci.yml)

An AI-first, single-user task manager. "AI-first" means the agent interface is not an afterthought
bolted onto a web app — the same task store is exposed through **25 MCP tools**, so an AI agent
creates, queries, updates, and organizes tasks as a first-class client alongside the human UI.

## Packages

| Package | Path | What it is |
|---|---|---|
| `web` | `apps/web` | Next.js 15 App Router UI (React 19, Tailwind 4, shadcn/ui) — task list and detail, drag-and-drop kanban, global search, settings |
| `@baker-street/db` | `packages/db` | Drizzle ORM schema, migrations, queries, seed — SQLite via in-process better-sqlite3 |
| `@baker-street/mcp-server` | `packages/mcp-server` | Express 5 MCP server, 25 tools over HTTP transport |

## Proof

- **94 tests** across the three packages (19 db · 52 mcp-server · 23 web) — `pnpm test`, run in CI

## Run it

```bash
pnpm install
pnpm dev          # creates the SQLite data dir, migrates, seeds, starts everything
pnpm test
pnpm typecheck && pnpm lint
```

Deployment to k3s (standalone, or as a Baker Street extension) is handled by
`scripts/deploy.sh [standalone|extension]`; Docker Compose and Kubernetes manifests are included.
`MCP_API_KEY` gates the MCP server — generate one with `openssl rand -hex 32` and supply it via
environment, never in a committed file.

Part of the [Baker Street](https://github.com/The-Baker-Street-Project/baker-street) project.

## License

MIT
