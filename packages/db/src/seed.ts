import { pathToFileURL } from "url";
import { createDb, getPgliteClient } from "./client";
import { savedViews } from "./schema/views";
import { eq } from "drizzle-orm";
import type { Database } from "./client";

export async function seedDb(db: Database) {
  console.log("Seeding system views...");

  // Clear existing system views to ensure idempotency
  await db.delete(savedViews).where(eq(savedViews.isSystem, true));

  await db.insert(savedViews).values([
    {
      name: "All Tasks",
      type: "Tasks",
      isSystem: true,
      sortOrder: 0,
      filterDefinition: { status: ["Inbox", "Active", "Someday"] },
    },
    {
      name: "Inbox",
      type: "Tasks",
      isSystem: true,
      sortOrder: 1,
      filterDefinition: { status: ["Inbox"] },
    },
    {
      name: "Active",
      type: "Tasks",
      isSystem: true,
      sortOrder: 2,
      filterDefinition: { status: ["Active"] },
    },
    {
      name: "Someday",
      type: "Tasks",
      isSystem: true,
      sortOrder: 3,
      filterDefinition: { status: ["Someday"] },
    },
  ]);

  console.log("Seed complete.");
}

// Only run as CLI when executed directly (not when imported by tests)
const isMainModule =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const db = createDb();
  seedDb(db)
    .then(async () => {
      await getPgliteClient().close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Seed failed:", err);
      try {
        await getPgliteClient().close();
      } catch {}
      process.exit(1);
    });
}
