import { pgTable, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";

export const conversationStatesTable = pgTable("conversation_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ConversationStateRow = typeof conversationStatesTable.$inferSelect;
export type InsertConversationState = typeof conversationStatesTable.$inferInsert;
