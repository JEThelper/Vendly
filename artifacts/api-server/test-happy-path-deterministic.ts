import { db, vendorsTable, ordersTable, menuItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ConversationManager } from "./src/lib/intelligence/conversation-manager";
import { clearPendingOrder } from "./src/lib/pending-orders";
import { toolRegistry } from "./src/lib/intelligence/tools";

async function runTests() {
  const [vendor] = await db.select().from(vendorsTable).limit(1);
  if (!vendor) process.exit(1);

  const adminPhone = "+15555555555";
  await db.update(vendorsTable).set({ adminNumber: adminPhone }).where(eq(vendorsTable.id, vendor.id));
  vendor.adminNumber = adminPhone;
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
  console.log("HAPPY PATH E2E TEST (Bypassing LLM API)");
  console.log("=============================================");
  
  console.log(`\n> [CUSTOMER]: I want to order 1 ${pizza.name}`);
  await toolRegistry.execute(vendor, customerPhone, { tool_name: "add_to_cart", arguments: { item_id: pizza.id, quantity: 1 } });
  console.log(`< [BOT]: I've added 1 Margherita Pizza to your cart. Would you like to proceed?`);

  console.log(`\n> [CUSTOMER]: confirm the order for delivery to 123 Main St`);
  const confirmRes = await toolRegistry.execute(vendor, customerPhone, { tool_name: "confirm_order", arguments: { delivery_type: "delivery", delivery_location: "123 Main St" } });
  console.log(`< [BOT]: ${confirmRes.message}`);

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
