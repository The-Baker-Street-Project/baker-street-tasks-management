import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "@baker-street/db/client";
import { registerTaskTools } from "./tasks";
import { registerSubtaskTools } from "./subtasks";
import { registerCaptureTools } from "./captures";
import { registerTagTools } from "./tags";
import { registerViewTools } from "./views";
import { registerAuditTools } from "./audit";
import { registerUndoTools } from "./undo";
import { registerSystemTools } from "./system";

/**
 * Register all MCP tools on the server instance.
 */
export function registerAllTools(server: McpServer, db: Database): void {
  registerTaskTools(server, db);
  registerSubtaskTools(server, db);
  registerCaptureTools(server, db);
  registerTagTools(server, db);
  registerViewTools(server, db);
  registerAuditTools(server, db);
  registerUndoTools(server, db);
  registerSystemTools(server, db);
}
