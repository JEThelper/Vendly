import { vendorsTable } from "./lib/db/src/schema";
import { eq } from "drizzle-orm";
import { db } from "./lib/db/src/index";

async function main() {
  console.log("querying db...");
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.phoneNumberId, "1142877348916383"))
    .limit(1);
  console.log("vendor:", vendor?.id);
  process.exit(0);
}
main().catch(console.error);
