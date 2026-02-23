import express, { Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createDb } from "@baker-street/db/client";
import { authMiddleware } from "./middleware/auth";
import { mcpRateLimiter } from "./middleware/rate-limit";
import { registerAllTools } from "./tools/index";

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

export const app: Express = express();

// Health endpoint — no auth required
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Apply auth and rate limiting to all /mcp routes
app.use("/mcp", authMiddleware, mcpRateLimiter);

// Map of session ID to MCP server + transport
const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

// ─── POST /mcp ──────────────────────────────────────────────────────
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    return;
  }

  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, { server, transport });
    },
  });

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

// ── standalone start (when run directly) ────────────────────────────

const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("/server.js") || process.argv[1].endsWith("/server.ts"));

if (isMainModule) {
  const PORT = parseInt(process.env.PORT ?? process.env.MCP_PORT ?? "3100", 10);
  app.listen(PORT, () => {
    console.log(`Baker Street Tasks MCP server listening on port ${PORT}`);
    console.log(`  POST/GET/DELETE /mcp  — MCP Streamable HTTP transport`);
    console.log(`  GET /health           — health check`);
  });
}
