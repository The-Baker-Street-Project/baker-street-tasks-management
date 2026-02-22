import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createDb } from "@baker-street/db/client";
import { authMiddleware } from "./middleware/auth";
import { mcpRateLimiter } from "./middleware/rate-limit";
import { registerAllTools } from "./tools/index";

// ── configuration ───────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3100", 10);

// ── database ────────────────────────────────────────────────────────

const db = createDb();

// ── MCP server ──────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "baker-street-tasks",
    version: "0.1.0",
  });

  registerAllTools(server, db);

  return server;
}

// ── Express app ─────────────────────────────────────────────────────

const app = express();

// Health endpoint — no auth required
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Apply auth and rate limiting to all /mcp routes
app.use("/mcp", authMiddleware, mcpRateLimiter);

// Map of session ID to MCP server + transport
const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

// ─── POST /mcp ──────────────────────────────────────────────────────
// Handles JSON-RPC requests. Creates a new session if no session ID is
// present, otherwise routes to the existing session's transport.
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Route to existing session
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    return;
  }

  // Create a new session
  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, { server, transport });
    },
  });

  // Clean up on close
  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      sessions.delete(sid);
    }
  };

  await server.connect(transport);
  await transport.handleRequest(req, res);
});

// ─── GET /mcp ───────────────────────────────────────────────────────
// SSE streaming endpoint for server-to-client notifications
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID. POST to /mcp first." });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
});

// ─── DELETE /mcp ────────────────────────────────────────────────────
// Session cleanup
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
  sessions.delete(sessionId);
});

// ── start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Baker Street Tasks MCP server listening on port ${PORT}`);
  console.log(`  POST/GET/DELETE /mcp  — MCP Streamable HTTP transport`);
  console.log(`  GET /health           — health check`);
});
