import { Action } from "./types";
import { VendorRow, db, menuItemsTable, ordersTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import { logger } from "../logger";
import { setPendingOrder, getPendingOrder, clearPendingOrder, PendingResolvedItem } from "../pending-orders";
import { generateOrderIdempotencyKey, checkIdempotencyKey, recordIdempotencyKey } from "../idempotency";
import { queueOutboundMessage } from "../queue";

export type ToolResult = {
  success: boolean;
  message?: string;
  data?: any;
  buttons?: Array<{ id: string; title: string }>;
  list?: any;
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

  const item = await db.query.menuItemsTable.findFirst({
    where: and(
      eq(menuItemsTable.id, item_id), 
      eq(menuItemsTable.vendorId, vendor.id),
      eq(menuItemsTable.available, true)
    )
  });

  if (!item) return { success: false, message: "Item not found or unavailable." };

  const pending = await getPendingOrder(vendor.id, customerPhone);
  let resolvedItems: PendingResolvedItem[] = pending.order?.resolvedItems || [];
  
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

toolRegistry.register("confirm_order", async (vendor, customerPhone, args: { payment_method: string, delivery_type: string, delivery_address?: string, payment_type?: string }) => {
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
      customerName: customerPhone, 
      status: "pending",
      paymentStatus: "pending",
      paymentType: args.payment_type || args.payment_method || null,
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

    // Notify Admin
    if (vendor.adminNumber && vendor.phoneNumberId) {
      let adminMsg = `New Order #${order.shortId} from ${customerPhone}\n`;
      adminMsg += `Payment: ${order.paymentType || "Not specified"}\n`;
      adminMsg += `Type: ${order.deliveryType}\n`;
      if (order.deliveryLocation) adminMsg += `Location: ${order.deliveryLocation}\n`;
      if (vendor.deliveryLocations && vendor.deliveryLocations.length > 0 && order.deliveryLocation && !vendor.deliveryLocations.includes(order.deliveryLocation)) {
         adminMsg += `\n⚠️ Note: Customer's address may be outside usual delivery area.\n`;
      }
      adminMsg += `\nItems:\n` + orderItems.map(oi => `${oi.quantity}x ${oi.itemName}`).join("\n");
      adminMsg += `\nTotal: ${vendor.currency} ${totalAmount.toFixed(2)}`;

      await queueOutboundMessage(vendor.phoneNumberId, vendor.adminNumber, adminMsg, undefined, [
        { id: `confirm ${order.shortId}`, title: "Confirm Order" },
        { id: `reject ${order.shortId}`, title: "Reject Order" }
      ]);
    }

    return { 
      success: true, 
      message: `Your order has been sent to ${vendor.name} for confirmation. You will be notified shortly!`, 
      data: { orderId: order.id, shortId: order.shortId } 
    };
  }

  return { success: false, message: "Failed to create order in database." };
});

toolRegistry.register("cancel_order", async (vendor, customerPhone, args: { order_id: string }) => {
  const { order_id } = args;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id);
  const order = await db.query.ordersTable.findFirst({
    where: and(isUuid ? eq(ordersTable.id, order_id) : eq(ordersTable.shortId, order_id), eq(ordersTable.customerPhone, customerPhone))
  });
  
  if (!order) return { success: false, message: "Order not found." };
  if (order.status === "cancelled" || order.status === "rejected") return { success: true, message: "Order is already cancelled." };
  
  await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, order.id));
  
  if (vendor.adminNumber && vendor.phoneNumberId) {
    await queueOutboundMessage(vendor.phoneNumberId, vendor.adminNumber, `Customer ${customerPhone} cancelled order #${order.shortId}.`);
  }
  return { success: true, message: `Order #${order.shortId} has been successfully cancelled.` };
});

toolRegistry.register("modify_pending_order", async (vendor, customerPhone, args: { order_id: string, modification_details: string }) => {
  const { order_id, modification_details } = args;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id);
  const order = await db.query.ordersTable.findFirst({
    where: and(isUuid ? eq(ordersTable.id, order_id) : eq(ordersTable.shortId, order_id), eq(ordersTable.customerPhone, customerPhone))
  });
  
  if (!order) return { success: false, message: "Order not found." };
  if (order.status !== "pending") return { success: false, message: "Order is no longer pending and cannot be directly modified." };

  if (vendor.adminNumber && vendor.phoneNumberId) {
    await queueOutboundMessage(vendor.phoneNumberId, vendor.adminNumber, `Customer ${customerPhone} wants to modify pending order #${order.shortId}:\n"${modification_details}"`);
  }
  return { success: true, message: `We've requested the vendor to update your order #${order.shortId} with: ${modification_details}` };
});

toolRegistry.register("flag_to_admin", async (vendor, customerPhone, args: { order_id: string, reason: string }) => {
  const { order_id, reason } = args;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id);
  const order = await db.query.ordersTable.findFirst({
    where: and(isUuid ? eq(ordersTable.id, order_id) : eq(ordersTable.shortId, order_id), eq(ordersTable.customerPhone, customerPhone))
  });
  
  if (!order) return { success: false, message: "Order not found." };
  
  if (vendor.adminNumber && vendor.phoneNumberId) {
    await queueOutboundMessage(vendor.phoneNumberId, vendor.adminNumber, `⚠️ Flagged by customer ${customerPhone} for order #${order.shortId} (Status: ${order.status}):\n"${reason}"\n\nNeeds human handling.`);
  }
  return { success: true, message: `I have notified the vendor directly regarding this issue with order #${order.shortId}. They will assist you shortly.` };
});
