
import { db, withVendorContext } from "../../lib/db/src/index";
import { handleIncomingMessage } from "./src/lib/bot";
import { vendorsTable } from "../../lib/db/src/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, "8956ddb6-2e0a-4d3b-a3ff-6f3a142cb32f"));
  if (!vendor) throw new Error("Vendor not found");

  console.log("Found vendor", vendor.name);
  console.log("Running handleIncomingMessage inside context...");

  try {
    const result = await withVendorContext(vendor.id, () => 
      handleIncomingMessage({
        vendor,
        fromPhone: "+15551112222",
        fromName: "Test Customer",
        body: "test message from simulator 3"
      })
    );
    console.log("Result:", result);
  } catch (e) {
    console.error("Error inside transaction:", e);
  }

  process.exit(0);
}

main().catch(console.error);
