import { db } from "@workspace/db";
import { pendingOrdersTable, ordersTable, vendorsTable, menuItemsTable } from "@workspace/db";
import { eq, inArray, like, ilike } from "drizzle-orm";
import { incomingQueue, outboundQueue } from "./src/lib/queue";

async function run() {
  console.log("Clearing pending orders...");
  // Clear pending orders (carts)
  await db.delete(pendingOrdersTable);
  
  // Clear actual orders that are pending
  await db.delete(ordersTable).where(inArray(ordersTable.status, ["pending", "awaiting_payment", "payment_pending_confirmation"]));
  console.log("Cleared pending orders from DB.");

  console.log("Stopping and clearing queue workers/jobs...");
  await incomingQueue.empty();
  await outboundQueue.empty();
  console.log("Cleared BullMQ queues.");

  console.log("Updating items for Vendly vendor...");
  const vendlyVendors = await db.select().from(vendorsTable).where(ilike(vendorsTable.name, "%vendly%"));
  if (vendlyVendors.length > 0) {
    const vendly = vendlyVendors[0];
    
    // Delete existing menu items so we start fresh with the new categories
    await db.delete(menuItemsTable).where(eq(menuItemsTable.vendorId, vendly.id));
    
    const items = [
      // Drinks
      { vendorId: vendly.id, name: "Coca-Cola", description: "Chilled can of Coca-Cola.", price: "2.50", category: "Drinks", available: true },
      { vendorId: vendly.id, name: "Mango Smoothie", description: "Fresh mango blended with yogurt.", price: "5.00", category: "Drinks", available: true },
      { vendorId: vendly.id, name: "Iced Tea", description: "Freshly brewed iced tea with lemon.", price: "3.00", category: "Drinks", available: true },
      
      // Appetizers
      { vendorId: vendly.id, name: "Spring Rolls", description: "Crispy vegetable spring rolls with sweet chili sauce.", price: "6.00", category: "Appetizers", available: true },
      { vendorId: vendly.id, name: "Chicken Wings", description: "Spicy buffalo chicken wings.", price: "8.50", category: "Appetizers", available: true },
      { vendorId: vendly.id, name: "Garlic Bread", description: "Toasted baguette with garlic butter and herbs.", price: "4.50", category: "Appetizers", available: true },
      
      // Soup
      { vendorId: vendly.id, name: "Chicken Noodle Soup", description: "Classic chicken noodle soup with fresh herbs.", price: "7.00", category: "Soup", available: true },
      { vendorId: vendly.id, name: "Tomato Basil Soup", description: "Creamy tomato soup with fresh basil.", price: "6.50", category: "Soup", available: true },
      
      // Protein (Meat, Fish, Chicken, Turkey)
      { vendorId: vendly.id, name: "Grilled Steak", description: "Juicy grilled beef steak cooked to perfection.", price: "18.00", category: "Protein", available: true },
      { vendorId: vendly.id, name: "Grilled Salmon", description: "Fresh Atlantic salmon with lemon butter sauce.", price: "16.50", category: "Protein", available: true },
      { vendorId: vendly.id, name: "Roast Chicken", description: "Half roasted chicken with herbs.", price: "14.00", category: "Protein", available: true },
      { vendorId: vendly.id, name: "Turkey Wings", description: "Slow-cooked savory turkey wings.", price: "12.00", category: "Protein", available: true },
    ];
    
    await db.insert(menuItemsTable).values(items);
    console.log(`Added ${items.length} items to ${vendly.name} with specific categories (Drinks, Appetizers, Soup, Protein).`);
  } else {
    console.log("Vendly vendor not found!");
  }

  process.exit(0);
}

run().catch(console.error);
