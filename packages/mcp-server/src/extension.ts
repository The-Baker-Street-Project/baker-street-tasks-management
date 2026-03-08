import { connect, NatsConnection, StringCodec } from "nats";

// ── NATS subjects (must match Baker Street platform) ────────────────

const EXTENSION_ANNOUNCE = "bakerst.extensions.announce";
const extensionHeartbeat = (id: string) => `bakerst.extensions.${id}.heartbeat`;

// ── Extension metadata ──────────────────────────────────────────────

const EXTENSION_ID = "baker-street-tasks";

const TOOLS = [
  "tasks.create", "tasks.get", "tasks.list", "tasks.update",
  "tasks.complete", "tasks.reopen", "tasks.search", "tasks.move_status",
  "tasks.bulk_update",
  "subtasks.add", "subtasks.toggle", "subtasks.reorder",
  "tags.list", "tags.create", "tags.rename", "tags.merge",
  "views.list", "views.create", "views.update",
  "audit.list", "audit.get",
  "undo.last_ai_action", "undo.by_id",
  "system.health", "system.capabilities",
];

// ── State ───────────────────────────────────────────────────────────

let nc: NatsConnection | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let startTime: number = 0;

const sc = StringCodec();

// ── Public API ──────────────────────────────────────────────────────

/**
 * Start extension registration. Connects to NATS, publishes announce,
 * and begins heartbeat loop. No-op if NATS_URL is not set.
 */
export async function startExtension(): Promise<void> {
  if (nc) return;
  const natsUrl = process.env.NATS_URL;
  if (!natsUrl) return;

  const mcpUrl =
    process.env.EXTENSION_MCP_URL ??
    `http://ext-${EXTENSION_ID}.bakerst.svc.cluster.local:8080/mcp`;

  try {
    nc = await connect({ servers: natsUrl });
    startTime = Date.now();

    // Announce
    const announce = {
      id: EXTENSION_ID,
      name: "Baker Street Tasks",
      version: "0.1.0",
      description:
        "Task management — create, update, search, and organize tasks",
      mcpUrl,
      transport: "streamable-http",
      tools: TOOLS,
      tags: ["tasks", "productivity"],
    };

    nc.publish(EXTENSION_ANNOUNCE, sc.encode(JSON.stringify(announce)));
    console.log(`Extension announced on NATS as "${EXTENSION_ID}"`);

    // Heartbeat every 30s
    heartbeatTimer = setInterval(() => {
      if (!nc || nc.isClosed()) {
        console.warn("Extension heartbeat skipped — NATS connection is closed");
        return;
      }
      const heartbeat = {
        id: EXTENSION_ID,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        activeRequests: 0,
      };
      nc.publish(
        extensionHeartbeat(EXTENSION_ID),
        sc.encode(JSON.stringify(heartbeat)),
      );
    }, 30_000);

    console.log("Extension heartbeat started (every 30s)");
  } catch (err) {
    console.error("Failed to connect to NATS for extension registration:", err);
    console.error("Extension registration disabled — MCP server continues without it.");
  }
}

/**
 * Stop extension registration. Clears heartbeat timer and drains NATS.
 */
export async function stopExtension(): Promise<void> {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (nc && !nc.isClosed()) {
    await nc.drain();
    nc = null;
  }
}
