import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * idempotency.ts
 * Prevents duplicate orders and messages when network retries occur.
 * 
 * How it works:
 * - Each order/message gets a unique idempotency key
 * - Key is checked before database write
 * - If key exists, return previous result instead of duplicating
 * - Survives process restarts (stored in database)
 */

/**
 * Generate a unique idempotency key for an order
 * Format: vendor:customer:timestamp:random
 * 
 * This ensures even if customer retries the exact same message,
 * we can detect it and not create duplicate orders
 */
export function generateOrderIdempotencyKey(
  vendorId: string,
  customerPhone: string,
  itemId: string,
): string {
  return `order:${vendorId}:${customerPhone}:${itemId}:${Date.now()}:${uuidv4().slice(0, 8)}`;
}

/**
 * Generate a unique idempotency key for a message
 */
export function generateMessageIdempotencyKey(
  phoneNumberId: string,
  to: string,
  messageContent: string,
): string {
  // Hash message content to create deterministic key
  // This means identical messages to same person get same key
  const contentHash = Buffer.from(messageContent).toString("base64").slice(0, 16);
  return `msg:${phoneNumberId}:${to}:${contentHash}:${Date.now()}`;
}

/**
 * Check if an idempotency key has already been used
 * Returns the order/message ID if it exists, null otherwise
 */
export async function checkIdempotencyKey(
  key: string,
): Promise<{ id: string; createdAt: Date } | null> {
  try {
    const result = await db.execute(sql`
      SELECT resource_id AS id, created_at 
      FROM idempotency_keys 
      WHERE key = ${key} 
      LIMIT 1
    `);

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as { id: string; created_at: Date };
      logger.debug({ key, resultId: row.id }, "Idempotency key found");
      return { id: row.id, createdAt: row.created_at };
    }

    return null;
  } catch (err) {
    logger.warn({ err, key }, "Failed to check idempotency key");
    return null;
  }
}

/**
 * Record that an idempotency key was used for a particular resource
 */
export async function recordIdempotencyKey(
  key: string,
  resourceId: string,
  resourceType: "order" | "message" | "broadcast",
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO idempotency_keys (key, resource_id, resource_type, created_at, expires_at)
      VALUES (
        ${key},
        ${resourceId},
        ${resourceType},
        NOW(),
        NOW() + INTERVAL '24 hours'
      )
      ON CONFLICT (key) DO NOTHING
    `);
  } catch (err) {
    logger.error({ err, key, resourceId }, "Failed to record idempotency key");
    // Don't throw - this is a secondary concern
  }
}

/**
 * Clean up expired idempotency keys (older than 24 hours)
 * Run this periodically (e.g., once per hour)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const result = await db.execute(sql`
      DELETE FROM idempotency_keys 
      WHERE expires_at < NOW()
    `);

    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      logger.info({ deletedCount }, "Cleaned up expired idempotency keys");
    }

    return deletedCount;
  } catch (err) {
    logger.error({ err }, "Failed to clean up idempotency keys");
    return 0;
  }
}

/**
 * Schedule periodic cleanup of idempotency keys
 */
export function scheduleIdempotencyKeyCleanup(intervalMs: number = 3600000): NodeJS.Timer {
  return setInterval(async () => {
    await cleanupExpiredIdempotencyKeys();
  }, intervalMs);
}
