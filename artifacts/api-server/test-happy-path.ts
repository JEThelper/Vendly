import { db, vendorsTable, ordersTable, pendingOrdersTable, menuItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ConversationManager } from "./src/lib/intelligence/conversation-manager";
import { clearPendingOrder } from "./src/lib/pending-orders";

async function runTests() {
  const [vendor] = await db.select().from(vendorsTable).limit(1);
  if (!vendor) {
    console.log("No vendor found");
    process.exit(1);
  }

  const adminPhone = vendor.adminNumber || "+15559999999";
  const customerPhone = "+19998887777";

  async function interact(phone: string, text: string) {
    console.log(`\n> [${phone === adminPhone ? "ADMIN" : "CUSTOMER"}]: ${text}`);
    const res = await ConversationManager.handleIncomingMessage(vendor, phone, text, "Test Customer");
    console.log(`< [BOT]: ${res.text}`);
    if (res.buttons) console.log(`  [Buttons]: ${JSON.stringify(res.buttons.map(b => b.title))}`);
    if (res.list) console.log(`  [List]: ${res.list.buttonText}`);
  }

  // Cleanup
  await clearPendingOrder(vendor.id, customerPhone);
  await db.delete(ordersTable).where(eq(ordersTable.customerPhone, customerPhone));

  // Seed Menu
  await db.delete(menuItemsTable).where(eq(menuItemsTable.vendorId, vendor.id));
  const [pizza] = await db.insert(menuItemsTable).values({ vendorId: vendor.id, name: "Margherita Pizza", price: "12.00", available: true }).returning();

  console.log("\n=============================================");
  console.log("HAPPY PATH E2E TEST");
  console.log("=============================================");
  await interact(customerPhone, `I want to order 1 ${pizza.name}`);
  await interact(customerPhone, "confirm the order for delivery to 123 Main St");
  
  // Get order ID
  let activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let order1 = activeOrders[0];

  await interact(adminPhone, `confirm ${order1.shortId}`);
  
  await interact(customerPhone, "I have paid");
  
  await interact(adminPhone, `paid ${order1.shortId}`);
  
  await interact(adminPhone, `eta ${order1.shortId} 15 mins`);
  
  await interact(adminPhone, `ontheway ${order1.shortId}`);
  
  await interact(customerPhone, "track my order");
  
  await interact(adminPhone, `delivered ${order1.shortId}`);
}

runTests().catch(console.error).finally(() => process.exit(0));
