import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { vendorsTable } from "./vendors";

export type OrderItemJson = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export const orderStatusEnum = pgEnum("order_status", ["pending", "awaiting_payment", "payment_pending_confirmation", "paid", "confirmed", "on_the_way", "delivered", "rejected", "cancelled"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "refunded"]);

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  shortId: text("short_id")
    .notNull()
    .default(sql`SUBSTRING(gen_random_uuid()::text, 1, 8)`),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendorsTable.id, { onDelete: "cascade" }),
  customerPhone: text("customer_phone").notNull(),
  customerName: text("customer_name").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  paymentType: text("payment_type"),
  deliveryType: text("delivery_type"),
  deliveryLocation: text("delivery_location"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  items: jsonb("items").$type<OrderItemJson[]>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  eta: text("eta"),
}, (table) => ({
  vendorStatusIdx: index("vendor_status_idx")
    .on(table.vendorId, table.status),
  vendorCustomerIdx: index("vendor_customer_idx")
    .on(table.vendorId, table.customerPhone),
  vendorCreatedIdx: index("vendor_created_idx")
    .on(table.vendorId, table.createdAt),
  vendorCustomerStatusCreatedIdx: index("vendor_customer_status_created_idx")
    .on(table.vendorId, table.customerPhone, table.status, table.createdAt),
}));

export type OrderRow = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;
