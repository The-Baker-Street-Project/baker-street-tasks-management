import { migrate } from "drizzle-orm/pglite/migrator";
import { createDb } from "./client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(dataDir?: string) {
  const db = createDb(dataDir);
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../drizzle"),
  });
}
