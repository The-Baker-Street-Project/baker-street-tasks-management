# Remove Captures Feature

**Date**: 2026-03-08
**Status**: Approved

## Decision

Remove the entire Captures feature. AI agents send tasks directly via MCP — no capture inbox needed. May re-add in the future.

## Scope

### Database (new Drizzle migration)
- Drop `capture_tags` junction table
- Drop `captures` table
- Remove `captureStatusEnum` enum
- Clean up captures-related audit_log entries
- Remove "All Captures" system view from seed

### Frontend (apps/web)
- Delete `app/(shell)/captures/` directory (2 pages)
- Delete `components/captures/` directory (5 components)
- Delete `components/shared/CaptureRow.tsx`
- Delete `lib/api/captures.ts` (server actions)
- Remove capture query keys from `lib/queries/query-keys.ts`
- Remove `Capture`, `CaptureStatus` types from `lib/types/index.ts`
- Remove PinnedCapturesBlock from dashboard
- Remove "Captures" from sidebar nav, bottom nav, command menu

### MCP Server (packages/mcp-server)
- Delete `tools/captures.ts` (10 tools)
- Remove capture tool registrations from `tools/index.ts`
- Tool count: 34 → 24

### DB Package (packages/db)
- Remove captures schema, relations, exports
- Update seed to remove "All Captures" system view

### Docs
- Update CLAUDE.md, app-summary.md, ui-design-brief.md

## What stays unchanged
- Tags (still used by tasks)
- Audit log (still used by tasks, subtasks, views)
- All task functionality
