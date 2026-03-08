import { createDb, getPgliteClient } from "./client";
import { savedViews } from "./schema/views";
import { eq } from "drizzle-orm";

async function seed() {
  const db = createDb();

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
  ]);

  console.log("Seed complete.");

  // Close PGlite to flush writes before exit
  await getPgliteClient().close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await getPgliteClient().close();
  } catch {}
  process.exit(1);
});
