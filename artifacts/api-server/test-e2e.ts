import { db, vendorsTable, ordersTable, pendingOrdersTable, menuItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ConversationManager } from "./src/lib/intelligence/conversation-manager";
import { clearPendingOrder } from "./src/lib/pending-orders";
import { queueOutboundMessage } from "./src/queue";

// Mock removed

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
  const [bread] = await db.insert(menuItemsTable).values({ vendorId: vendor.id, name: "Garlic Bread", price: "5.00", available: true }).returning();
  const [pep] = await db.insert(menuItemsTable).values({ vendorId: vendor.id, name: "Pepperoni Pizza", price: "15.00", available: true }).returning();

  console.log("\n=============================================");
  console.log("SCENARIO 13: Tracking with no active order");
  console.log("=============================================");
  await interact(customerPhone, "track my order");

  console.log("\n=============================================");
  console.log("SCENARIO 1 & 12: Happy Path Delivery + Tracking");
  console.log("=============================================");
  await interact(customerPhone, `I want to order 1 ${pizza.name}`);
  await interact(customerPhone, "That's it, confirm the order for delivery to 123 Main St");
  
  // Get order ID
  let activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let order1 = activeOrders[0];

  await interact(customerPhone, "track my order"); // (pending stage)
  
  await interact(adminPhone, `confirm ${order1.shortId}`);
  await interact(customerPhone, "track my order"); // (awaiting_payment stage)
  
  await interact(customerPhone, "account details"); // SCENARIO 8
  await interact(customerPhone, "I have paid");
  await interact(adminPhone, `paid ${order1.shortId}`);
  
  await interact(adminPhone, `ontheway ${order1.shortId}`);
  await interact(customerPhone, "track my order"); // (on_the_way stage)
  
  await interact(adminPhone, `delivered ${order1.shortId}`);

  console.log("\n=============================================");
  console.log("SCENARIO 2: Happy Path Pickup");
  console.log("=============================================");
  await interact(customerPhone, "I want 1 Garlic Bread");
  await interact(customerPhone, "confirm for pickup");
  activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let order2 = activeOrders[0];
  await interact(adminPhone, `confirm ${order2.shortId}`);
  await interact(customerPhone, "i have paid");
  await interact(adminPhone, `paid ${order2.shortId}`);
  await interact(adminPhone, `ontheway ${order2.shortId}`); // Ready for pickup
  await interact(adminPhone, `delivered ${order2.shortId}`); // Picked up

  console.log("\n=============================================");
  console.log("SCENARIO 3: Admin rejects order");
  console.log("=============================================");
  await interact(customerPhone, "I want 1 Pepperoni Pizza");
  await interact(customerPhone, "confirm for delivery to 456 Elm St");
  activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let order3 = activeOrders[0];
  await interact(adminPhone, `reject ${order3.shortId}`);

  console.log("\n=============================================");
  console.log("SCENARIO 4 & 5: Customer modifies then cancels before confirm");
  console.log("=============================================");
  await interact(customerPhone, "I want 1 Margherita Pizza");
  await interact(customerPhone, "confirm for pickup");
  activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let order4 = activeOrders[0];
  
  await interact(customerPhone, "Change that to 2 pizzas instead"); // SCENARIO 5
  await interact(customerPhone, "Actually just cancel the whole order"); // SCENARIO 4

  console.log("\n=============================================");
  console.log("SCENARIO 6 & 7: Customer modifies AFTER confirm, Admin Payment Not Received");
  console.log("=============================================");
  await interact(customerPhone, "I want 1 Garlic Bread");
  await interact(customerPhone, "confirm for pickup");
  activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let order5 = activeOrders[0];
  await interact(adminPhone, `confirm ${order5.shortId}`);
  
  await interact(customerPhone, "Wait, make that 2 garlic breads"); // SCENARIO 6
  
  await interact(customerPhone, "i have paid");
  await interact(adminPhone, `not_paid ${order5.shortId}`); // SCENARIO 7
  await interact(customerPhone, "Oops, let me resend");
  await interact(customerPhone, "i have paid");
  await interact(adminPhone, `paid ${order5.shortId}`);
  await interact(adminPhone, `delivered ${order5.shortId}`);

  console.log("\n=============================================");
  console.log("SCENARIO 9 & 10: Vendor delivery-only and outside area");
  console.log("=============================================");
  await db.update(vendorsTable).set({ 
    requiresDeliveryAddress: true, 
    deliveryLocations: ["Lagos Island", "Ikoyi"] 
  }).where(eq(vendorsTable.id, vendor.id));

  await interact(customerPhone, "I want 1 Margherita Pizza");
  await interact(customerPhone, "confirm order"); 
  await interact(customerPhone, "deliver it to Ikeja, Lagos"); 
  
  activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let order6 = activeOrders[0];
  await interact(adminPhone, `reject ${order6.shortId}`);

  console.log("\n=============================================");
  console.log("SCENARIO 11: Concurrent orders");
  console.log("=============================================");
  await interact(customerPhone, "I want 1 Pepperoni Pizza");
  await interact(customerPhone, "confirm order to Ikoyi");
  activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let orderA = activeOrders[0];
  await interact(adminPhone, `confirm ${orderA.shortId}`);
  await interact(adminPhone, `paid ${orderA.shortId}`);
  await interact(adminPhone, `ontheway ${orderA.shortId}`);

  await interact(customerPhone, "I want 1 Garlic Bread now");
  await interact(customerPhone, "confirm order to Ikoyi");
  activeOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerPhone, customerPhone)).orderBy(desc(ordersTable.createdAt));
  let orderB = activeOrders[0];
  await interact(adminPhone, `confirm ${orderB.shortId}`);
  
  await interact(adminPhone, `delivered ${orderA.shortId}`);
  await interact(adminPhone, `delivered ${orderB.shortId}`);
}

runTests().catch(console.error).finally(() => process.exit(0));
