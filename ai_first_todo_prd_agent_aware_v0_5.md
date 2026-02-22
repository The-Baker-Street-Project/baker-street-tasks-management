# AI-First To-Do + Capture

## Product Requirements Document (Agent-Aware)

**Version v0.5 (Draft)** · Single-user · Next.js/React/TypeScript + Tailwind/shadcn · Postgres · Vercel

**Date:** February 11, 2026

---

## 1. Product Summary

A single-user to-do app optimized for fast scanning, mobile use, and AI-first creation via MCP. The system intentionally separates actionable work (Tasks) from non-actionable memory/ideas (Capture Vault), so AI can help without turning every thought into homework.

### 1.1 Goals

- Most items are created/updated via the AI MCP interface with minimal user friction.
- No-regrets capture: store ideas and memories without scheduling them as obligations.
- Fast daily triage: a dashboard that answers "what matters now?" in under 10 seconds.
- Safe AI writes: attribution, audit trail, idempotency, and one-click undo.
- Mobile-first usability (responsive, thumb-friendly, PWA).

### 1.2 Non-Goals (for v1)

- Collaboration, sharing, or multi-user workspaces.
- Authentication (username/password, sessions, MFA) — planned v1.1.
- Recurring tasks — planned v1.1.
- File attachments — planned v1.1.
- Telegram integration (inbound capture, commands, reminders, digests) — planned v1.1.
- Planner Agent (Focus 3 suggestions, daily plan, deferral suggestions) — planned v1.1.
- Custom Kanban columns beyond the baseline statuses — planned later.

---

## 2. Scope & Release Plan

### 2.1 v1 (MVP) Feature Set

- Core objects: Tasks, one-level Subtasks, Tags, Capture Vault items, Saved Views, Audit Log.
- Home / Work context as a filter (not separate workspaces).
- Dashboard with blocks: Overdue, Due Today, Next Up, High Priority, Inbox, Focus 3 (manual pin only), Pinned Captures.
- Tasks view: 3-pane "Mail" layout (views list, task list, task detail).
- Capture Vault view: list + detail, promote to Task, pin/review/archive.
- Kanban view: status columns with drag-and-drop; swimlanes defined by Saved Views (custom filters).
- Global search across Tasks, Subtasks, Captures, Tags.
- Manual creation via "+" button in web UI for both Tasks and Captures.
- MCP server (HTTP+SSE): read/write tools for Tasks/Captures/Tags/Views, plus audit/undo.

### 2.2 v1.1 (Deferred) Feature Set

- Authentication: username + password, password reset, session management, MFA (TOTP/app-based).
- Recurring tasks (daily/weekly/monthly/custom).
- Attachments (file uploads or external link previews).
- Telegram integration: inbound capture, inbound commands, outbound reminders/digests.
- Planner Agent: Focus 3 suggestions, daily plan generation, deferral suggestions.
- Additional notification channels beyond PWA.

---

## 3. IA & Screens

### 3.1 Primary Navigation

- Dashboard
- Tasks
- Capture Vault
- Kanban
- Search
- Settings

### 3.2 Dashboard (Scanning & Triage)

- **Overdue:** tasks with due date < now.
- **Due Today:** tasks due today (all-day and timed).
- **Next Up:** soonest upcoming due tasks.
- **High Priority:** top priority tasks (with optional due filter).
- **Inbox:** AI-created actionable tasks awaiting review.
- **Focus 3:** manually pinned tasks for today (AI suggestions deferred to v1.1).
- **Pinned Captures:** surfaced from Capture Vault (default: pinned only).

Dashboard quick actions:

- Complete / Reopen
- Snooze
- Schedule (set due date/time)
- Move to Someday
- Promote Capture → Task

### 3.3 Tasks (Default) — 3-pane Layout

- **Left pane:** Home/Work toggle, system views (Inbox/Today/Upcoming/Someday/Completed), Saved Views, Tags.
- **Middle pane:** fast-scannable list rows (title, due, priority, tags, subtask progress, AI badge). Includes a "+" button for manual task creation.
- **Right pane:** task details editor (all properties + subtasks + audit snippet).

Mobile behavior:

- Left pane becomes a drawer/sheet.
- Middle pane is the default view; selecting a task pushes to a full-screen detail page.
- Swipe actions on list rows (complete, snooze) with safe defaults.
- Back navigation returns to the task list.

### 3.4 Tasks (Table View) — Power Mode (Optional in v1)

- TanStack Table layout for bulk filtering/sorting (status, priority, due, tags, context).
- Bulk actions (tag, move status, complete) with undo support.

### 3.5 Capture Vault

- Default destination for ambiguous AI input (ideas, memories, "don't forget").
- Views: Recent, Pinned, Reviewed, Archived; filterable by tags and context.
- Actions: Promote to Task; AI-assisted "Extract tasks" (propose first); pin/review/archive.
- Optional "nudge me later" reminder (not a due date).
- "+" button for manual capture creation.
- **Reviewed** status is an "I've seen this" acknowledgment, useful for filtering to surface only un-triaged items.

### 3.6 Kanban (View, Not the Whole App)

- Columns in v1: Inbox / Active / Done.
- Drag-and-drop changes status; reorder within column.
- Swimlanes: each lane is a Saved View (custom filter).
- Cards display: title, due, priority, tags, subtask progress.

### 3.7 Settings

- **Preferences:** timezone, default context, default landing screen, dashboard block toggles.
- **Tags:** rename/merge/delete.
- **AI/MCP:** manage API key; view recent tool usage.

---

## 4. Core Data Model (Feature Level)

### 4.1 Task

- `title` (required), `notes`
- `status`: Inbox | Active | Someday | Done | Archived
- `context`: Home | Work
- `priority`: P0 (Urgent) | P1 (High) | P2 (Medium) | P3 (Low)
- `due_at` (optional), `start_at` (optional)
- `reminders` (optional: one or more offsets/times)
- `estimate` (optional), `order_index` (fractional indexing for drag-and-drop reorder)
- `tags` (many-to-many)
- `subtasks` (one-level, see 4.1.1)
- Timestamps: `created_at`, `updated_at`, `completed_at` (optional)
- AI metadata: `created_by`, `updated_by`, `agent_id`, `source_message_id`, `request_id`, `reason`

#### 4.1.1 Subtask

- `title` (required)
- `done`: boolean
- `order_index` (fractional indexing)
- AI metadata: `created_by`, `agent_id`, `request_id`

#### 4.1.2 Subtask Completion Behavior

When a parent task is marked Done:

1. If any subtasks are incomplete, display a warning/confirmation to the user.
2. On confirmation, auto-complete all incomplete subtasks.
3. Record the auto-completion in the audit log with a reference to the parent task completion.

### 4.2 Capture

- `title` (required), `body`
- `status`: Captured | Reviewed | Archived
- `pinned`: boolean
- `context` (optional)
- `source`: web_ui | mcp
- `tags` (many-to-many)
- `nudge_at` (optional)
- Timestamps + AI metadata (same pattern as Task)

### 4.3 Tag

- `name` (unique), optional `color`
- Merge/rename support to control tag sprawl

### 4.4 Saved View

- `name`, `type` (Tasks | Captures | KanbanLane)
- `is_system`: boolean (system views cannot be deleted, only hidden)
- Filter definition (stored JSON): status/context/tags/due ranges/search, etc.

#### Default System Views

The following views ship out of the box and cannot be deleted (can be hidden):

- **Due This Week** — tasks with due dates within the current week
- **High Priority** — tasks with priority P0 or P1
- **Work** — tasks with context = Work
- **Home** — tasks with context = Home

### 4.5 Audit Log

- Record of AI (and optionally user) changes: before/after snapshot or diff, timestamp, agent_id.
- Supports Undo for AI actions (single step or recent history).
- Undo operates per-entity: undoes the last AI change to a specific task/capture, not globally, to avoid clobbering manual user edits.

---

## 5. AI Agent System

The agent system is designed as focused agents with clear responsibilities.

### 5.1 Agent Roles (v1)

- **Router Agent:** classifies incoming text as Task vs Capture; normalizes fields; applies routing defaults.
- **Triage Agent (lower priority):** de-duplicates, tags, fixes malformed items; keeps Inbox clean with low-risk edits.

### 5.2 Router Agent (Capture-first)

- Default routing for AI/MCP input: create a Capture unless the text is clearly actionable.
- If actionable with a time constraint, create a Task with due date/time (Inbox unless explicitly Active).
- If actionable but underspecified: create a Task in Inbox with a clarifying note (no back-and-forth required).
- Support explicit override syntax (examples): `! do X tomorrow` forces Task; `~ idea: ...` forces Capture.

Inputs:

- Text input + optional metadata (timestamp, source context, timezone).

Outputs:

- MCP tool calls to create Task or Capture with idempotency keys.

### 5.3 Triage Agent (Cleanup & Safety) — Lower Priority for v1

- Detect likely duplicates (same title/time window/tags) and propose merge.
- Suggest tags using existing tag vocabulary before creating new tags.
- Fix obvious parsing errors (dates, context) and add missing defaults.
- Optionally suggest subtasks for multi-step tasks (one-level only).

Guardrails:

- Never deletes; only archives with explicit instruction.
- Bulk edits use dry-run preview by default, always with undo support.

---

## 6. MCP Services & Tooling

### 6.1 Services

- **Todo MCP Server (core):** exposes domain tools for Tasks/Captures/Tags/Views + audit/undo. Accessible over HTTP+SSE for use with Claude Code and similar LLM tools.
- **MCP Inspector (dev):** interactive testing of tools/resources during development.

### 6.2 Authentication for MCP Access

- Single shared API key configured via environment variable.
- All tool calls recorded in the audit log with `agent_id` and `request_id`.
- PAT system with scopes, rotation, and revocation UI deferred to v1.1 (with auth).

### 6.3 Tool Catalog (MVP)

**Tasks:**

- `tasks.create`, `tasks.update`, `tasks.complete`, `tasks.reopen`
- `tasks.get` (single entity by ID)
- `tasks.list` (filters: status, context, due range, tags)
- `tasks.search` (full-text)
- `tasks.move_status` (Inbox/Active/Someday/Done/Archived)
- `tasks.bulk_update` (supports `dry_run`)

**Subtasks:**

- `subtasks.add`, `subtasks.toggle`, `subtasks.reorder`

**Captures:**

- `captures.create`, `captures.update`, `captures.pin`, `captures.unpin`, `captures.review`, `captures.archive`
- `captures.get` (single entity by ID)
- `captures.promote_to_task`
- `captures.extract_tasks` (returns proposed tasks; apply requires explicit call)

**Tags & Views:**

- `tags.list`, `tags.create` (rate-limited), `tags.rename`, `tags.merge`
- `views.list`, `views.create`, `views.update`

**Safety:**

- `audit.list`, `audit.get`
- `undo.last_ai_action` (per-entity), `undo.by_id`
- `system.health`, `system.capabilities`

### 6.4 Guardrails (Server-side)

- **Idempotency:** every create/update accepts `request_id` and/or `source_message_id` to prevent duplicates.
- **Validation:** strict schema validation for all tool inputs (reject malformed dates/fields).
- **Rate limiting:** baseline limit on create/update calls (e.g., 60 creates/minute) to protect against runaway agent loops.
- **Risk-tier operations:** bulk destructive actions require explicit confirmation mode (or are disabled in v1).

---

## 7. Non-Functional Requirements

### 7.1 Performance & UX

- Dashboard loads fast and remains scannable on mobile.
- Optimistic UI updates (especially for complete/snooze) with eventual consistency.
- Accessible navigation: keyboard support on desktop, proper semantics for screen readers.

### 7.2 Reliability & Data Safety

- Soft delete/archival; no hard deletes in v1 (reduces accidental loss).
- Audit and undo for AI actions.
- Backups and export hooks planned (export can be added early if desired).

### 7.3 Security

- API key validation on every MCP tool call.
- Rate limiting on MCP endpoints.
- Server-side authorization on every tool call (even single-user).

---

## 8. Acceptance Criteria (Feature Checklist)

- AI can create Captures from MCP input by default (idempotent).
- AI creates a Task only when clearly actionable; ambiguous input does not become a Task by default.
- User can manually create Tasks and Captures via "+" button in the web UI.
- Dashboard shows Overdue / Today / Next Up / High Priority / Inbox / Focus 3 (manual) / Pinned Captures.
- Tasks view supports editing properties, tags, Someday status, one-level subtasks, and an audit snippet.
- Completing a task with incomplete subtasks warns the user, then auto-completes subtasks on confirmation.
- Kanban supports drag status changes and swimlanes driven by Saved Views.
- Default system views (Due This Week, High Priority, Work, Home) ship out of the box.
- Audit log records AI changes with `agent_id` and supports per-entity undo of AI actions.
- MCP server is accessible over HTTP+SSE and protected by API key.
- Global search works across Tasks, Subtasks, Captures, and Tags.
