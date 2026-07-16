import { Action } from "./types";
import { VendorRow, db, menuItemsTable, ordersTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import { logger } from "../logger";
import { setPendingOrder, getPendingOrder, clearPendingOrder, PendingResolvedItem } from "../pending-orders";
import { generateOrderIdempotencyKey, checkIdempotencyKey, recordIdempotencyKey } from "../idempotency";

export type ToolResult = {
  success: boolean;
  message?: string;
  data?: any;
};

export type ToolHandler = (vendor: VendorRow, customerPhone: string, args: any) => Promise<ToolResult>;

class ToolRegistry {
  private tools: Map<string, ToolHandler> = new Map();

  register(name: string, handler: ToolHandler) {
    this.tools.set(name, handler);
  }

  async execute(vendor: VendorRow, customerPhone: string, action: Action): Promise<ToolResult> {
    const handler = this.tools.get(action.tool_name);
    if (!handler) {
      logger.warn(`Tool ${action.tool_name} not found`);
      return { success: false, message: `Tool ${action.tool_name} is not implemented yet.` };
    }
    
    try {
      return await handler(vendor, customerPhone, action.arguments);
    } catch (error: any) {
      logger.error({ error, args: action.arguments }, `Error executing tool ${action.tool_name}`);
      return { success: false, message: error.message || "Internal tool error." };
    }
  }
}

export const toolRegistry = new ToolRegistry();

// ==========================================
// TOOL IMPLEMENTATIONS
// ==========================================

toolRegistry.register("search_menu", async (vendor, customerPhone, args: { query: string }) => {
  const query = args.query.toLowerCase();
  const items = await db.query.menuItemsTable.findMany({
    where: and(
      eq(menuItemsTable.vendorId, vendor.id),
      eq(menuItemsTable.available, true),
      ilike(menuItemsTable.name, `%${query}%`)
    ),
    columns: { id: true, name: true, price: true }
  });
  
  if (items.length === 0) {
    return { success: true, message: `No items found matching "${query}".` };
  }
  return { success: true, data: items, message: `Found ${items.length} items.` };
});

toolRegistry.register("add_to_cart", async (vendor, customerPhone, args: { item_id: string, quantity: number }) => {
  const { item_id, quantity } = args;
  
  if (quantity <= 0) return { success: false, message: "Quantity must be greater than 0." };

  // Verify item exists and is active
  const item = await db.query.menuItemsTable.findFirst({
    where: and(
      eq(menuItemsTable.id, item_id), 
      eq(menuItemsTable.vendorId, vendor.id),
      eq(menuItemsTable.available, true)
    )
  });

  if (!item) return { success: false, message: "Item not found or unavailable." };

  // Get current pending order
  const pending = await getPendingOrder(vendor.id, customerPhone);
  let resolvedItems: PendingResolvedItem[] = pending.order?.resolvedItems || [];
  
  // Add or update
  const existingIndex = resolvedItems.findIndex(i => i.menuItemId === item_id);
  if (existingIndex >= 0) {
    resolvedItems[existingIndex].quantity += quantity;
    resolvedItems[existingIndex].total = resolvedItems[existingIndex].quantity * resolvedItems[existingIndex].unitPrice;
  } else {
    resolvedItems.push({
      menuItemId: item.id,
      itemName: item.name,
      quantity,
      unitPrice: Number(item.price),
      total: Number(item.price) * quantity
    });
  }

  const total = resolvedItems.reduce((sum, i) => sum + i.total, 0);
  await setPendingOrder(vendor.id, customerPhone, resolvedItems, null, total);

  return { success: true, message: `Added ${quantity}x ${item.name} to cart.`, data: { total } };
});

toolRegistry.register("remove_from_cart", async (vendor, customerPhone, args: { item_id: string }) => {
  const { item_id } = args;
  
  const pending = await getPendingOrder(vendor.id, customerPhone);
  if (!pending.order || pending.order.resolvedItems.length === 0) {
    return { success: false, message: "Cart is already empty." };
  }

  const resolvedItems = pending.order.resolvedItems.filter(i => i.menuItemId !== item_id);
  
  if (resolvedItems.length === 0) {
    await clearPendingOrder(vendor.id, customerPhone);
    return { success: true, message: "Item removed. Cart is now empty." };
  }

  const total = resolvedItems.reduce((sum, i) => sum + i.total, 0);
  await setPendingOrder(vendor.id, customerPhone, resolvedItems, null, total);

  return { success: true, message: "Item removed from cart.", data: { total } };
});

toolRegistry.register("update_quantity", async (vendor, customerPhone, args: { item_id: string, quantity: number }) => {
  const { item_id, quantity } = args;
  
  if (quantity <= 0) return await toolRegistry.execute(vendor, customerPhone, { tool_name: "remove_from_cart", arguments: { item_id } });

  const pending = await getPendingOrder(vendor.id, customerPhone);
  if (!pending.order) return { success: false, message: "Cart is empty." };

  const resolvedItems = pending.order.resolvedItems;
  const existingIndex = resolvedItems.findIndex(i => i.menuItemId === item_id);
  
  if (existingIndex < 0) return { success: false, message: "Item not in cart." };

  resolvedItems[existingIndex].quantity = quantity;
  resolvedItems[existingIndex].total = quantity * resolvedItems[existingIndex].unitPrice;

  const total = resolvedItems.reduce((sum, i) => sum + i.total, 0);
  await setPendingOrder(vendor.id, customerPhone, resolvedItems, null, total);

  return { success: true, message: `Updated quantity to ${quantity}.`, data: { total } };
});

toolRegistry.register("confirm_order", async (vendor, customerPhone, args: { payment_method: string, delivery_type: string, delivery_address?: string }) => {
  const pending = await getPendingOrder(vendor.id, customerPhone);
  
  if (!pending.order || pending.order.resolvedItems.length === 0) {
    return { success: false, message: "Cannot confirm order. Cart is empty." };
  }

  const orderItems = pending.order.resolvedItems;
  const totalAmount = pending.order.total;

  const itemKey = orderItems.map((oi) => `${oi.menuItemId}:${oi.quantity}`).join(",");
  const idempotencyKey = generateOrderIdempotencyKey(vendor.id, customerPhone, itemKey);

  const existingKey = await checkIdempotencyKey(idempotencyKey);
  if (existingKey) {
    return { success: true, message: "Order already confirmed previously.", data: { orderId: existingKey.id } };
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      vendorId: vendor.id,
      customerPhone,
      customerName: customerPhone, // Default to phone if name unknown here
      status: "pending",
      paymentStatus: "pending",
      deliveryType: args.delivery_type || "pickup",
      deliveryLocation: args.delivery_address || null,
      total: totalAmount.toFixed(2),
      currency: vendor.currency,
      items: orderItems.map((oi) => ({
        name: oi.itemName,
        quantity: oi.quantity,
        unitPrice: Number(oi.unitPrice),
      })),
    })
    .returning();

  if (order) {
    await recordIdempotencyKey(idempotencyKey, order.id, "order");
    await clearPendingOrder(vendor.id, customerPhone);
    return { success: true, message: `Order #${order.shortId} confirmed!`, data: { orderId: order.id, shortId: order.shortId } };
  }

  return { success: false, message: "Failed to create order in database." };
});
