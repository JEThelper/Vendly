import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import {
  ListVendorConversationsParams,
  GetConversationParams,
  UpdateConversationParams,
  UpdateConversationBody,
  SendMessageParams,
  SendMessageBody,
} from "@workspace/api-zod";
import { toConversation, toMessage } from "../lib/serializers";

const router: IRouter = Router();

router.get("/vendors/:vendorId/conversations", async (req, res) => {
  const params = ListVendorConversationsParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.vendorId, params.data.vendorId))
    .orderBy(desc(conversationsTable.lastMessageAt));
  return res.json(rows.map((r) => toConversation(r)));
});

router.get("/conversations/:conversationId", async (req, res) => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, params.data.conversationId))
    .limit(1);
  if (!conv) return res.status(404).json({ error: "not_found" });
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(asc(messagesTable.createdAt));
  return res.json({
    ...toConversation(conv),
    messages: messages.map(toMessage),
  });
});

router.patch("/conversations/:conversationId", async (req, res) => {
  const params = UpdateConversationParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const body = UpdateConversationBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body", details: body.error.issues });

  const updates: Record<string, unknown> = {};
  if (body.data.status !== undefined) updates.status = body.data.status;
  if (body.data.markRead) updates.unreadCount = 0;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "no_fields" });

  const [updated] = await db
    .update(conversationsTable)
    .set(updates)
    .where(eq(conversationsTable.id, params.data.conversationId))
    .returning();
  if (!updated) return res.status(404).json({ error: "not_found" });
  return res.json(toConversation(updated));
});

router.post("/conversations/:conversationId/messages", async (req, res) => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "invalid_params" });
  const body = SendMessageBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_body", details: body.error.issues });

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, params.data.conversationId))
    .limit(1);
  if (!conv) return res.status(404).json({ error: "not_found" });

  const sender = body.data.sender ?? "vendor";
  const [created] = await db
    .insert(messagesTable)
    .values({
      conversationId: conv.id,
      direction: "out",
      sender,
      body: body.data.body,
    })
    .returning();

  const preview = body.data.body.length > 80 ? body.data.body.slice(0, 77) + "..." : body.data.body;
  await db
    .update(conversationsTable)
    .set({ lastMessagePreview: preview, lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, conv.id));
  return res.status(201).json(toMessage(created!));

  res.status(201).json(toMessage(created!));
});

export default router;
