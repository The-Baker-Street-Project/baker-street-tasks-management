import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _dbUrl: string | null = null;

export function createDb(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  // Return singleton if same URL (or no explicit URL)
  if (_db && _dbUrl === url) return _db;
  const client = postgres(url);
  _db = drizzle(client, { schema });
  _dbUrl = url;
  return _db;
}

export type Database = ReturnType<typeof createDb>;
