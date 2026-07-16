import { db } from "./lib/db/src/index";
import { vendorsTable } from "./lib/db/src/schema";
async function main() {
  const vendors = await db.select().from(vendorsTable);
  console.log(vendors.map(v => ({ name: v.name, phoneNumberId: v.phoneNumberId })));
  process.exit(0);
}
main().catch(console.error);
