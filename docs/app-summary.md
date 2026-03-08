# Baker Street Tasks — App Summary

## What It Is

A personal, AI-first task management system. Single-user, no auth. Designed to be operated both through a web UI and by an AI agent via MCP (Model Context Protocol). Every action the AI takes is auditable and undoable.

Part of the Baker Street Project — a personal AI agent platform deployed on local Kubernetes.

## Core Concepts

### Tasks
The primary work unit. A task has a lifecycle: **Inbox** (uncategorized) -> **Active** (working on) -> **Done** (completed). Side tracks: **Someday** (deferred) and **Archived** (hidden).

Each task carries:
- **Title** and optional **notes** (markdown)
- **Priority**: P0 (Urgent), P1 (High), P2 (Medium), P3 (Low)
- **Context**: Home or Work — filters the entire UI
- **Focus flag**: Pin up to 3 tasks as your current focus
- **Due date** and **start date**
- **Estimate** in hours
- **Subtasks**: Ordered checklist items with drag-and-drop reordering
- **Tags**: User-defined labels with optional colors
- **AI metadata**: Who created it (web UI or AI agent), why, and full audit trail

### Tags
User-created labels with optional hex colors. Applied to tasks. Tags can be merged (reassign all references, delete source).

### Saved Views
Predefined and custom filtered views of tasks. System views (All Tasks, Inbox, Active) are seeded and cannot be deleted.

### Audit Log
Every write operation records a before/after snapshot. AI actions include agent ID, request ID, and a human-readable reason. Any AI action can be undone — restoring the entity to its previous state.

## Key Features

### Dashboard
Six at-a-glance blocks on the home screen:
1. **Overdue** — Tasks past their due date
2. **Due Today** — Tasks due today
3. **Next Up** — First 5 active tasks by manual order
4. **High Priority** — P0 and P1 tasks
5. **Focus 3** — Your pinned focus tasks (max 3)
6. **Inbox** — Unprocessed tasks

### Task Management
- List view with virtual scrolling (handles large lists efficiently)
- Sort by due date, priority, creation date, or manual drag-and-drop order
- Filter by status, context (Home/Work), and tags
- Inline task completion via checkbox
- Detail panel (sidebar on desktop, full page on mobile) with full editing
- Subtask management with progress tracking and drag-and-drop reorder
- Quick task creation dialog

### Kanban Board
- Three columns: Inbox, Active, Done
- Drag-and-drop cards between columns (via @dnd-kit)
- Cards show priority, due date, subtask progress, and tags
- Fractional indexing for stable ordering without renumbering

### Global Search
- Full-text search across tasks
- Uses PostgreSQL tsvector for ranked results

### Context Filtering
- Toggle between All, Home, and Work contexts
- Persisted in URL query params (shareable/bookmarkable)
- Filters the entire UI globally from the sidebar

### Command Palette
- Cmd+K (Mac) / Ctrl+K (Windows) quick navigation
- Navigate to any page or create a new task

### Settings
- Tag management: create, edit colors, delete

## AI Integration (MCP Server)

The app exposes **25 MCP tools** over HTTP, organized by domain:

| Domain | Tools | Key Operations |
|--------|-------|----------------|
| Tasks (9) | create, get, list, update, complete, reopen, search, move_status, bulk_update | Full lifecycle management |
| Subtasks (3) | add, toggle, reorder | Checklist operations |
| Tags (4) | list, create, rename, merge | Tag management with merge |
| Views (3) | list, create, update | Custom view management |
| Audit (2) | list, get | Change history browsing |
| Undo (2) | last_ai_action, by_id | Revert any AI change |
| System (2) | health, capabilities | Status and tool discovery |

### AI Safety Features
- **Idempotency**: All write tools accept a `request_id`. Duplicate requests return the cached result instead of double-executing.
- **Audit trail**: Every AI action records before/after snapshots with agent ID and human-readable reason.
- **Undo**: Any AI action can be reverted by audit ID or by undoing the last AI action on an entity.
- **Source tracking**: All entities record whether they were created by `web_ui` or `mcp` (AI agent).

### Baker Street Extension
When deployed with NATS connectivity, the MCP server registers as a Baker Street platform extension. The Brain (central AI agent) auto-discovers all 25 tools and can manage tasks on behalf of the user.

## Data Model

```
tasks ──────┬── subtasks (1:many, cascade delete)
             ├── task_tags ──── tags (many:many)
             └── audit_log (via entityType + entityId)

saved_views ─── audit_log (via entityType + entityId)

tags ────────── task_tags (1:many)
```

### Key Design Decisions
- **PGlite (WASM Postgres)**: In-process database, no external DB server needed. Single-writer constraint.
- **Fractional indexing**: Text-based `orderIndex` fields enable drag-and-drop reordering without renumbering other items.
- **Server actions**: All database access goes through Next.js `"use server"` functions — no API routes in the web app.
- **Soft deletes**: Status-based lifecycle (Done/Archived) rather than hard deletes.
- **No auth in v1**: Single API key for MCP server. No user sessions or login flow.

## Responsive Design

| Feature | Desktop (md+) | Mobile |
|---------|---------------|--------|
| Navigation | Collapsible sidebar | Fixed bottom nav bar |
| Task detail | Side panel alongside list | Full-page view |
| Quick create | Button in list header | Floating action button (FAB) |
| Kanban | Horizontal scroll | Horizontal scroll |
| Command palette | Cmd+K modal | Ctrl+K modal |

## Deployment

Single Docker image deployed as a Kubernetes pod on local k3s. In production, a unified `server.ts` runs both the Next.js frontend and MCP server in one process (required by PGlite's single-writer constraint).

Optional NATS integration for Baker Street platform extension registration with 30-second heartbeat.
