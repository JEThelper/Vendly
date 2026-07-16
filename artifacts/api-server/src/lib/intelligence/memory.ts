import { db } from "@workspace/db";
import { conversationsTable, messagesTable, customersTable, ordersTable, type VendorRow } from "@workspace/db";
import { eq, and, desc, notInArray } from "drizzle-orm";
import { MemoryContext } from "./types";
import { getPendingOrder } from "../pending-orders";

export async function loadContext(vendor: VendorRow, customerPhone: string, customerName?: string): Promise<MemoryContext> {
  // 1. Get conversation
  let conversation = await db.query.conversationsTable.findFirst({
    where: and(eq(conversationsTable.vendorId, vendor.id), eq(conversationsTable.customerPhone, customerPhone)),
  });

  if (!conversation) {
    const insertData: any = {
      vendorId: vendor.id,
      customerPhone,
      customerName: customerName || "Customer",
    };
    [conversation] = await db.insert(conversationsTable).values(insertData).returning();
  }

  // 2. Load short-term history
  const historyRows = await db.query.messagesTable.findMany({
    where: eq(messagesTable.conversationId, conversation!.id),
    orderBy: [desc(messagesTable.createdAt)],
    limit: 6,
  });

  const history = historyRows.reverse().map(msg => ({
    role: (msg as any).direction === "in" ? "customer" : "bot",
    text: (msg as any).content || (msg as any).body || "",
  })) as Array<{ role: "customer" | "bot"; text: string }>;

  // 3. Load Long Term Memory (Customer Info)
  let customerInfo = await db.query.customersTable.findFirst({
    where: and(eq(customersTable.vendorId, vendor.id), eq(customersTable.phone, customerPhone)),
  });

  // 4. Load Working State (Active Pending Order / Cart)
  const pending = await getPendingOrder(vendor.id, customerPhone);
  const activeCart = pending.order ? { items: pending.order.resolvedItems, total: pending.order.total } : null;

  // 4b. Load Active Submitted Orders (Pending, Paid, On the Way, etc.)
  const activeOrders = await db.query.ordersTable.findMany({
    where: and(
      eq(ordersTable.vendorId, vendor.id),
      eq(ordersTable.customerPhone, customerPhone),
      notInArray(ordersTable.status, ["delivered", "rejected", "cancelled"])
    ),
    columns: { id: true, shortId: true, status: true, total: true, deliveryType: true, deliveryLocation: true, eta: true, items: true, paymentStatus: true }
  });

  // 5. Business Rules
  const businessRules = {
    name: vendor.name,
    description: (vendor as any).description,
    currency: vendor.currency,
    requiresDeliveryAddress: vendor.requiresDeliveryAddress,
    deliveryLocations: vendor.deliveryLocations,
  };

  return {
    history,
    workingState: activeCart,
    activeOrders,
    longTermMemory: customerInfo ? { name: customerInfo.name, location: (customerInfo as any).location, context: (customerInfo as any).conversationContext } : null,
    businessRules,
  };
}
