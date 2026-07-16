import {
  pgTable,
  text,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const idempotencyKeysTable = pgTable(
  "idempotency_keys",
  {
    key: text("key").notNull(),
    resourceId: text("resource_id").notNull(),
    resourceType: text("resource_type").notNull(), // 'order' | 'message' | 'broadcast'
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => {
    return {
      // Composite primary key
      pk: primaryKey({ columns: [table.key] }),
      // Index for cleanup queries (delete expired)
      expiresAtIdx: index("idempotency_keys_expires_at_idx").on(table.expiresAt),
      // Index for lookups
      resourceIdx: index("idempotency_keys_resource_idx")
        .on(table.resourceId, table.resourceType),
    };
  },
);

export type IdempotencyKeyRow = typeof idempotencyKeysTable.$inferSelect;
export type InsertIdempotencyKey = typeof idempotencyKeysTable.$inferInsert;
