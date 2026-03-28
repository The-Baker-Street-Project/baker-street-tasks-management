import { fileURLToPath } from "url";
import path from "path";
import { createServer } from "http";
import { parse } from "url";
import { runMigrations } from "@baker-street/db/migrate";
import { createDb, getSqliteClient } from "@baker-street/db/client";
import { setupFts } from "@baker-street/db/fts";
import { app as mcpApp } from "@baker-street/mcp-server/app";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const webPort = parseInt(process.env.PORT ?? "3000", 10);
const mcpPort = parseInt(process.env.MCP_PORT ?? "3100", 10);

async function main() {
  // 1. Ensure data directory exists
  const dbPath = process.env.SQLITE_DB_PATH ?? "./data/tasks.db";
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 2. Initialize SQLite
  console.log("Initializing SQLite...");
  createDb(dbPath);

  // 3. Run migrations
  console.log("Running migrations...");
  runMigrations(dbPath);

  // 4. Set up FTS5
  console.log("Setting up FTS5 full-text search...");
  setupFts(getSqliteClient());

  // 5. Boot Next.js
  // In production standalone mode, inject the config so Next.js finds pre-built pages
  if (!dev) {
    const configPath = path.join(__dirname, ".next", "required-server-files.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config.config);
    }
    process.chdir(__dirname);
  }

  const next = (await import("next")).default;
  const nextApp = next({ dev, hostname, port: webPort, dir: __dirname });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.listen(webPort, hostname, () => {
    console.log(`Next.js ready on http://${hostname}:${webPort}`);
  });

  // 6. Boot MCP server on separate port
  mcpApp.listen(mcpPort, hostname, () => {
    console.log(`MCP server ready on http://${hostname}:${mcpPort}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
