import { db, pendingOrdersTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";

type PendingResolvedItem = {
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type PendingClarification = {
  originalText: string;
  quantity: number;
  candidates: Array<{ itemId: string; itemName: string; confidence: number }>;
  remaining: Array<{ text: string; quantity: number }>;
};

export type PendingOrder = {
  id: string;
  vendorId: string;
  customerPhone: string;
  resolvedItems: PendingResolvedItem[];
  pendingClarification: PendingClarification | null;
  total: number;
  timestamp: Date;
  expiresAt: Date;
};

/**
 * Store a pending order in the database instead of memory.
 * This survives process restarts and enables multi-instance deployments.
 */
export async function setPendingOrder(
  vendorId: string,
  customerPhone: string,
  resolvedItems: PendingResolvedItem[],
  pendingClarification: PendingClarification | null,
  total: number,
): Promise<PendingOrder | null> {
  try {
    await db
      .delete(pendingOrdersTable)
      .where(
        and(
          eq(pendingOrdersTable.vendorId, vendorId),
          eq(pendingOrdersTable.customerPhone, customerPhone),
        ),
      );

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [created] = await db
      .insert(pendingOrdersTable)
      .values({
        vendorId,
        customerPhone,
        resolvedItems,
        pendingClarification,
        total: total.toString(),
        createdAt: new Date(),
        expiresAt,
      })
      .returning();

    if (!created) return null;

    return {
      id: created.id,
      vendorId: created.vendorId,
      customerPhone: created.customerPhone,
      resolvedItems: created.resolvedItems,
      pendingClarification: created.pendingClarification,
      total: Number(created.total),
      timestamp: created.createdAt,
      expiresAt: created.expiresAt,
    };
  } catch (err) {
    logger.error({ err, vendorId, customerPhone }, "Failed to set pending order");
    return null;
  }
}

/**
 * Retrieve a pending order for a customer
 */
export async function getPendingOrder(
  vendorId: string,
  customerPhone: string,
): Promise<PendingOrder | null> {
  try {
    // Clean up expired orders first
    await cleanupExpiredPendingOrders(vendorId);

    const [pending] = await db
      .select()
      .from(pendingOrdersTable)
      .where(
        and(
          eq(pendingOrdersTable.vendorId, vendorId),
          eq(pendingOrdersTable.customerPhone, customerPhone),
        ),
      )
      .limit(1);

    if (!pending) return null;

    // Check if expired
    if (new Date() > pending.expiresAt) {
      await db
        .delete(pendingOrdersTable)
        .where(eq(pendingOrdersTable.id, pending.id));
      return null;
    }

    return {
      id: pending.id,
      vendorId: pending.vendorId,
      customerPhone: pending.customerPhone,
      resolvedItems: pending.resolvedItems,
      pendingClarification: pending.pendingClarification,
      total: Number(pending.total),
      timestamp: pending.createdAt,
      expiresAt: pending.expiresAt,
    };
  } catch (err) {
    logger.error({ err, vendorId, customerPhone }, "Failed to get pending order");
    return null;
  }
}

/**
 * Clear/delete a pending order
 */
export async function clearPendingOrder(
  vendorId: string,
  customerPhone: string,
): Promise<void> {
  try {
    await db
      .delete(pendingOrdersTable)
      .where(
        and(
          eq(pendingOrdersTable.vendorId, vendorId),
          eq(pendingOrdersTable.customerPhone, customerPhone),
        ),
      );
  } catch (err) {
    logger.error({ err, vendorId, customerPhone }, "Failed to clear pending order");
  }
}

/**
 * Clean up expired pending orders for a vendor
 * Call this periodically or before operations
 */
export async function cleanupExpiredPendingOrders(vendorId: string): Promise<number> {
  try {
    const result = await db
      .delete(pendingOrdersTable)
      .where(
        and(
          eq(pendingOrdersTable.vendorId, vendorId),
          lt(pendingOrdersTable.expiresAt, new Date()),
        ),
      )
      .returning();

    if (result.length > 0) {
      logger.debug({ vendorId, count: result.length }, "Cleaned up expired pending orders");
    }

    return result.length;
  } catch (err) {
    logger.error({ err, vendorId }, "Failed to cleanup expired pending orders");
    return 0;
  }
}

/**
 * Global cleanup task - remove all expired pending orders across all vendors
 * Schedule this to run every 5 minutes
 */
export async function cleanupAllExpiredPendingOrders(): Promise<number> {
  try {
    const result = await db
      .delete(pendingOrdersTable)
      .where(lt(pendingOrdersTable.expiresAt, new Date()))
      .returning();

    if (result.length > 0) {
      logger.info({ count: result.length }, "Global cleanup: expired pending orders removed");
    }

    return result.length;
  } catch (err) {
    logger.error({ err }, "Failed to cleanup all expired pending orders");
    return 0;
  }
}

/**
 * Schedule periodic cleanup of expired pending orders
 */
export function scheduleExpiredPendingOrdersCleanup(intervalMs: number = 3600000): NodeJS.Timer {
  return setInterval(async () => {
    try {
      const deleted = await cleanupAllExpiredPendingOrders();
      logger.debug({ count: deleted }, "Scheduled pending orders cleanup completed");
    } catch (err) {
      logger.error({ err }, "Scheduled pending orders cleanup failed");
    }
  }, intervalMs);
}
