import { pgTable, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";

export const adminContextsTable = pgTable("admin_contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendorsTable.id, { onDelete: "cascade" }),
  context: jsonb("context").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AdminContextRow = typeof adminContextsTable.$inferSelect;
export type InsertAdminContext = typeof adminContextsTable.$inferInsert;
