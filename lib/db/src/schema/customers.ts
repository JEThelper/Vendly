import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  numeric,
  unique,
} from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";

export const customersTable = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendorsTable.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
    totalOrders: integer("total_orders").notNull().default(0),
    totalSpent: numeric("total_spent", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    vendorPhoneUnique: unique().on(t.vendorId, t.phone),
  }),
);

export type CustomerRow = typeof customersTable.$inferSelect;
export type InsertCustomer = typeof customersTable.$inferInsert;
