import { db, messagesTable } from "./src/index";
import { desc } from "drizzle-orm";

async function main() {
  const msgs = await db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt)).limit(50);
  console.log("Recent messages:");
  for (const m of msgs) {
    console.log(`[${m.createdAt}] ${m.direction} (${m.role}): ${m.body.slice(0, 60)}`);
  }
  process.exit(0);
}

main().catch(console.error);
