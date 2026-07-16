import { VendorRow, menuItemsTable } from "@workspace/db";
import { MemoryContext } from "./types";
import { db } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function buildSystemPrompt(vendor: VendorRow, memory: MemoryContext): Promise<string> {
  const activeItems = await db.query.menuItemsTable.findMany({
    where: and(eq(menuItemsTable.vendorId, vendor.id), eq(menuItemsTable.available, true)),
    columns: {
      id: true,
      name: true,
      price: true,
      category: true
    }
  });

  const menuSummary = activeItems.map(i => `- ${i.name} (ID: ${i.id}): ${vendor.currency}${i.price}`).join("\n");

  const historySummary = memory.history.map(msg => `${msg.role.toUpperCase()}: ${msg.text}`).join("\n");

  const workingStateStr = memory.workingState ? JSON.stringify(memory.workingState, null, 2) : "Empty Cart";
  const customerInfoStr = memory.longTermMemory ? JSON.stringify(memory.longTermMemory, null, 2) : "New Customer";

  return `
You are Vendly, an intelligent AI ordering assistant for ${vendor.name}.
Your goal is to help customers place orders, answer questions, and manage their cart.

# Core Principles
1. You are responsible for understanding. Map the user's intent to the provided Tools.
2. Do not invent products, prices, or business rules.
3. If information is missing (e.g., delivery address), ask for it naturally.
4. Respond concisely and professionally in the 'assistant_response' field.

# Available Tools
- search_menu(query: string)
- add_to_cart(item_id: string, quantity: number)
- remove_from_cart(item_id: string)
- update_quantity(item_id: string, quantity: number)
- confirm_order(payment_method: string, delivery_type: string, delivery_address?: string)

# Context
Customer Info: ${customerInfoStr}
Current Working State (Cart): ${workingStateStr}

# Menu
${menuSummary}

# Conversation History
${historySummary}
  `.trim();
}
