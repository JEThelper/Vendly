import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { vendorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  WhatsappWebhookBody,
  SimulateIncomingMessageBody,
} from "@workspace/api-zod";
import { handleIncomingMessage } from "../lib/bot";

const router: IRouter = Router();

router.post("/webhook/whatsapp", async (req, res) => {
  const body = WhatsappWebhookBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "invalid_body", details: body.error.issues });
  }

  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.phoneNumber, body.data.to))
    .limit(1);

  if (!vendor) {
    req.log.warn({ to: body.data.to }, "No vendor matches inbound number");
    return res.status(404).json({ ok: false, botReply: null, conversationId: null });
  }

  const result = await handleIncomingMessage({
    vendor,
    customerPhone: body.data.from,
    customerName: body.data.profileName ?? body.data.from,
    body: body.data.body,
  });

  res.json({
    ok: true,
    botReply: result.botReply,
    conversationId: result.conversation.id,
  });
});

router.post("/simulator/incoming", async (req, res) => {
  const body = SimulateIncomingMessageBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "invalid_body", details: body.error.issues });
  }

  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, body.data.vendorId))
    .limit(1);

  if (!vendor) return res.status(404).json({ error: "vendor_not_found" });

  const result = await handleIncomingMessage({
    vendor,
    customerPhone: body.data.customerPhone,
    customerName: body.data.customerName ?? body.data.customerPhone,
    body: body.data.body,
  });

  res.json({
    ok: true,
    botReply: result.botReply,
    conversationId: result.conversation.id,
  });
});

export default router;
