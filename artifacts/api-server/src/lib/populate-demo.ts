import { db, vendorsTable, menuItemsTable } from "@workspace/db";

async function populateDemo() {
  console.log("Populating Demo Data...");

  // 1. Create a Vendor
  const [vendor] = await db.insert(vendorsTable).values({
    name: "Demo Pizza Shop",
    phoneNumber: "+15551234567",
    adminNumber: "+15559999999",
    phoneNumberId: "phone_id_demo_1",
    botEnabled: true
  }).returning();

  console.log(`Created Vendor: ${vendor.id}`);

  // 2. Create Menu Items
  await db.insert(menuItemsTable).values([
    {
      vendorId: vendor.id,
      name: "Margherita Pizza",
      description: "Classic cheese and tomato pizza",
      price: "12.00",
      available: true
    },
    {
      vendorId: vendor.id,
      name: "Pepperoni Pizza",
      description: "Classic pepperoni",
      price: "15.00",
      available: true
    },
    {
      vendorId: vendor.id,
      name: "Garlic Bread",
      description: "Side of garlic bread",
      price: "5.00",
      available: true
    }
  ]);

  console.log("Created Menu Items.");
  process.exit(0);
}

populateDemo().catch(console.error);
