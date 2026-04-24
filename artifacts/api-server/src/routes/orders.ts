import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
  paymentsTable,
  customersTable,
  vendorsTable,
  conversationsTable,
} from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  ListVendorOrdersParams,
  ListVendorOrdersQueryParams,
  GetOrderParams,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
} from "@workspace/api-zod";
import { toOrder } from "../lib/serializers";
import { notifyOrderConfirmedToCustomer } from "../lib/bot";

const router: IRouter = Router();

router.get("/vendors/:vendorId/orders", async (req, res) => {
  const params = ListVendorOrdersParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const query = ListVendorOrdersQueryParams.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "invalid_query" });

  const conditions = [eq(ordersTable.vendorId, params.data.vendorId)];
  if (query.data.status) conditions.push(eq(ordersTable.status, query.data.status));

  const rows = await db
    .select()
    .from(ordersTable)
    .where(and(...conditions))
    .orderBy(desc(ordersTable.createdAt));
  res.json(rows.map((r) => toOrder(r)));
});

router.get("/orders/:orderId", async (req, res) => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.orderId))
    .limit(1);
  if (!order) return res.status(404).json({ error: "not_found" });
  res.json(toOrder(order));
});

router.patch("/orders/:orderId", async (req, res) => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body", details: body.error.issues });

  const [updated] = await db
    .update(ordersTable)
    .set({ status: body.data.status })
    .where(eq(ordersTable.id, params.data.orderId))
    .returning();
  if (!updated) return res.status(404).json({ error: "not_found" });

  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, updated.vendorId))
    .limit(1);

  // When moving to confirmed: send payment instructions to the customer's chat.
  if (body.data.status === "confirmed" && vendor) {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.vendorId, vendor.id),
          eq(conversationsTable.customerPhone, updated.customerPhone),
        ),
      )
      .limit(1);
    if (conv) {
      await notifyOrderConfirmedToCustomer({
        vendor,
        conversationId: conv.id,
        total: Number(updated.total),
      });
    }
  }

  // When moving to paid: record a payment + bump customer totals.
  if (body.data.status === "paid") {
    await db.insert(paymentsTable).values({
      vendorId: updated.vendorId,
      orderId: updated.id,
      customerName: updated.customerName,
      amount: updated.total,
      currency: updated.currency,
      method: "bank_transfer",
      status: "confirmed",
      reference: body.data.note ?? null,
    });
    await db
      .insert(customersTable)
      .values({
        vendorId: updated.vendorId,
        phone: updated.customerPhone,
        name: updated.customerName,
        totalOrders: 1,
        totalSpent: updated.total,
      })
      .onConflictDoUpdate({
        target: [customersTable.vendorId, customersTable.phone],
        set: {
          totalOrders: sql`${customersTable.totalOrders} + 1`,
          totalSpent: sql`${customersTable.totalSpent} + ${updated.total}`,
          name: updated.customerName,
          lastSeenAt: new Date(),
        },
      });
  }

  res.json(toOrder(updated));
});

export default router;
