import { db } from "@workspace/db";
import { conversationsTable, messagesTable, customersTable, type VendorRow } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { MemoryContext } from "./types";
import { getPendingOrder } from "../pending-orders";

export async function loadContext(vendor: VendorRow, customerPhone: string): Promise<MemoryContext> {
  // 1. Get conversation
  let conversation = await db.query.conversationsTable.findFirst({
    where: and(eq(conversationsTable.vendorId, vendor.id), eq(conversationsTable.customerPhone, customerPhone)),
  });

  if (!conversation) {
    const insertData: any = {
      vendorId: vendor.id,
      customerPhone,
    };
    [conversation] = await db.insert(conversationsTable).values(insertData).returning();
  }

  // 2. Load short-term history
  const historyRows = await db.query.messagesTable.findMany({
    where: eq(messagesTable.conversationId, conversation!.id),
    orderBy: [desc(messagesTable.createdAt)],
    limit: 10,
  });

  const history = historyRows.reverse().map(msg => ({
    role: (msg as any).direction === "in" ? "customer" : "bot",
    text: (msg as any).content || (msg as any).body || "",
  })) as Array<{ role: "customer" | "bot"; text: string }>;

  // 3. Load Long Term Memory (Customer Info)
  let customerInfo = await db.query.customersTable.findFirst({
    where: and(eq(customersTable.vendorId, vendor.id), eq(customersTable.phone, customerPhone)),
  });

  // 4. Load Working State (Active Pending Order)
  const pending = await getPendingOrder(vendor.id, customerPhone);
  const activeOrder = pending.order ? { items: pending.order.resolvedItems, total: pending.order.total } : null;

  // 5. Business Rules
  const businessRules = {
    name: vendor.name,
    description: (vendor as any).description,
    currency: vendor.currency,
  };

  return {
    history,
    workingState: activeOrder,
    longTermMemory: customerInfo ? { name: customerInfo.name, location: (customerInfo as any).location, context: (customerInfo as any).conversationContext } : null,
    businessRules,
  };
}
