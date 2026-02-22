import { z } from "zod";
import { sql } from "drizzle-orm";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ── register ────────────────────────────────────────────────────────

export function registerSystemTools(server: McpServer, db: Database) {
  // ─── system.health ─────────────────────────────────────────────
  server.tool(
    "system.health",
    "Check that the MCP server and database are operational",
    {},
    async () => {
      try {
        const result = await db.execute(sql`SELECT 1 AS ok`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "healthy",
              database: "connected",
              timestamp: new Date().toISOString(),
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "unhealthy",
              database: "disconnected",
              error: err instanceof Error ? err.message : String(err),
              timestamp: new Date().toISOString(),
            }),
          }],
          isError: true,
        };
      }
    },
  );

  // ─── system.capabilities ──────────────────────────────────────
  server.tool(
    "system.capabilities",
    "List all available tools and their descriptions",
    {},
    async () => {
      const capabilities = {
        version: "0.1.0",
        tools: [
          // Tasks
          { name: "tasks.create", description: "Create a new task" },
          { name: "tasks.get", description: "Get a single task by ID" },
          { name: "tasks.list", description: "List tasks with filters and pagination" },
          { name: "tasks.update", description: "Update one or more fields on a task" },
          { name: "tasks.complete", description: "Mark a task as Done" },
          { name: "tasks.reopen", description: "Reopen a completed/archived task" },
          { name: "tasks.search", description: "Full-text search across tasks" },
          { name: "tasks.move_status", description: "Move a task to a different status column" },
          { name: "tasks.bulk_update", description: "Update the same fields across multiple tasks" },
          // Subtasks
          { name: "subtasks.add", description: "Add a subtask to a task" },
          { name: "subtasks.toggle", description: "Toggle a subtask done/undone" },
          { name: "subtasks.reorder", description: "Reorder a subtask among siblings" },
          // Captures
          { name: "captures.create", description: "Create a new capture" },
          { name: "captures.get", description: "Get a capture by ID" },
          { name: "captures.update", description: "Update fields on a capture" },
          { name: "captures.pin", description: "Pin a capture" },
          { name: "captures.unpin", description: "Unpin a capture" },
          { name: "captures.review", description: "Mark a capture as reviewed" },
          { name: "captures.archive", description: "Archive a capture" },
          { name: "captures.promote_to_task", description: "Convert a capture into a task" },
          { name: "captures.extract_tasks", description: "Extract multiple tasks from a capture" },
          // Tags
          { name: "tags.list", description: "List all tags" },
          { name: "tags.create", description: "Create a new tag" },
          { name: "tags.rename", description: "Rename a tag" },
          { name: "tags.merge", description: "Merge one tag into another" },
          // Views
          { name: "views.list", description: "List all saved views" },
          { name: "views.create", description: "Create a saved view" },
          { name: "views.update", description: "Update a saved view" },
          // Audit
          { name: "audit.list", description: "List audit log entries" },
          { name: "audit.get", description: "Get a single audit log entry" },
          // Undo
          { name: "undo.last_ai_action", description: "Undo the last AI action for an entity" },
          { name: "undo.by_id", description: "Undo a specific audit log entry" },
          // System
          { name: "system.health", description: "Health check" },
          { name: "system.capabilities", description: "List all tools" },
        ],
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(capabilities) }] };
    },
  );
}
