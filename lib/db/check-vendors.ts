import { db, vendorsTable } from "./src/index";

async function main() {
  const vendors = await db.select().from(vendorsTable);
  for (const v of vendors) {
    console.log(`Vendor: ${v.name}`);
    console.log(`  Phone Number: ${v.phoneNumber}`);
    console.log(`  Phone Number ID: ${v.phoneNumberId || 'NULL'}`);
    console.log(`  WABA ID: ${v.wabaId || 'NULL'}`);
  }
  process.exit(0);
}

main().catch(console.error);
