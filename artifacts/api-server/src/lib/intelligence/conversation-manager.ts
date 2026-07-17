import { VendorRow, db } from "@workspace/db";
import { loadContext } from "./memory";
import { buildSystemPrompt } from "./context";
import { llmService } from "./llm";
import { toolRegistry } from "./tools";
import { logger } from "../logger";
import { queueOutboundMessage } from "../queue";
import { isAdminSender, handleAdminCommand, buildMenuMessage, recordMessage, findOrCreateConversation, paymentInstructions } from "../bot";
import { getPendingOrder, clearPendingOrder, setPendingOrder } from "../pending-orders";
import { ordersTable, vendorsTable, promotionsTable, conversationsTable } from "@workspace/db";
import { eq, and, desc, inArray, notInArray } from "drizzle-orm";

type DeterministicResult = { text: string | null; buttons?: Array<{id: string; title: string}>; list?: any; ruleMatched: string } | null;

async function tryDeterministicMatch(
  vendor: VendorRow,
  customerPhone: string,
  message: string,
  isAdmin: boolean,
  incomingMessageId?: string
): Promise<DeterministicResult> {
  let normalized = message.trim().toLowerCase();
  normalized = normalized.replace(/[.,!?…]+$/, "");
  normalized = normalized.replace(/\s+/g, " ");

  if (["👍", "🙏", "✅"].includes(normalized)) normalized = "yes";
  if (["👎", "❌"].includes(normalized)) normalized = "no";

  if (isAdmin) {
    if (normalized === "orders") {
      const adminReply = await handleAdminCommand(vendor, "orders");
      if (adminReply) return { ...adminReply, ruleMatched: "admin_orders" };
      return null;
    }
    if (normalized.startsWith("/promo list")) {
      const promos = await db.select().from(promotionsTable).where(and(eq(promotionsTable.vendorId, vendor.id), eq(promotionsTable.active, true)));
      if (promos.length === 0) return { text: "No active promotions found.", ruleMatched: "admin_promo_list" };
      return { text: "Active Promos:\n" + promos.map(p => `- ${p.title}`).join("\n"), ruleMatched: "admin_promo_list" };
    }
    if (normalized.startsWith("/bot on")) {
      await db.update(vendorsTable).set({ botEnabled: true }).where(eq(vendorsTable.id, vendor.id));
      return { text: "Bot is now enabled for this vendor.", ruleMatched: "admin_bot_on" };
    }
    if (normalized.startsWith("/bot off")) {
      await db.update(vendorsTable).set({ botEnabled: false }).where(eq(vendorsTable.id, vendor.id));
      return { text: "Bot is now disabled for this vendor.", ruleMatched: "admin_bot_off" };
    }
    if (normalized.startsWith("/admin") || normalized === "help" || normalized === "/help") {
      return {
        text: "Admin Commands:",
        buttons: [
          { id: "orders", title: "View Pending Orders" },
          { id: "/promo list", title: "View Promos" },
          { id: "/bot on", title: "Bot ON (Enable)" },
          { id: "/bot off", title: "Bot OFF (Disable)" }
        ],
        ruleMatched: "admin_help"
      };
    }
    if (normalized.startsWith("/debug")) {
      return { text: "Debug info: " + vendor.id, ruleMatched: "admin_debug" };
    }
    if (normalized.startsWith("/reset")) {
      await clearPendingOrder(vendor.id, customerPhone);
      return { text: "Cart and pending state cleared for your number.", ruleMatched: "admin_reset" };
    }
    if (normalized.startsWith("confirm ") || ["confirm", "confirm order", "yes confirm"].includes(normalized)) {
      if (normalized.startsWith("confirm ")) {
        const adminReply = await handleAdminCommand(vendor, normalized);
        if (adminReply) return { ...adminReply, ruleMatched: "admin_confirm" };
        return null;
      }
      return { text: "Please provide the order ID to confirm, e.g. confirm 1234", ruleMatched: "admin_confirm_missing_id" };
    }
    if (normalized.startsWith("reject ") || ["reject", "reject order", "cancel order"].includes(normalized)) {
      if (normalized.startsWith("reject ")) {
        const adminReply = await handleAdminCommand(vendor, normalized);
        if (adminReply) return { ...adminReply, ruleMatched: "admin_reject" };
        return null;
      }
      return { text: "Please provide the order ID to reject, e.g. reject 1234", ruleMatched: "admin_reject_missing_id" };
    }
    if (normalized.startsWith("eta ") || normalized.startsWith("paid ") || normalized.startsWith("not_paid ") || normalized.startsWith("ontheway ") || normalized.startsWith("delivered ")) {
      const adminReply = await handleAdminCommand(vendor, normalized);
      if (adminReply) return { ...adminReply, ruleMatched: "admin_command" };
      return null;
    }
    if (["payment confirmed", "confirm payment", "paid confirmed", "paid"].includes(normalized)) {
      return { text: "Please provide the order ID to confirm payment, e.g. paid 1234", ruleMatched: "admin_paid_missing_id" };
    }
    if (["on the way", "out for delivery", "delivered", "ready for pickup", "picked up"].includes(normalized)) {
      return { text: `Please use the exact command with the order ID to update status, e.g. "eta 1234 15 mins"`, ruleMatched: "admin_status_update" };
    }
  }

  if (message.startsWith("/reset")) {
      await clearPendingOrder(vendor.id, customerPhone);
      return { text: "Your pending order and cart have been cleared. What would you like to do next?", ruleMatched: "customer_reset" };
    }

    const greetings = ["hi", "hello", "hey", "hiya", "hi there", "hello there", "morning", "good morning", "afternoon", "good afternoon", "evening", "good evening", "menu", "start", "hi please", "good day"];
    if (greetings.includes(normalized)) {
      const activeUnpaidOrders = await db.select().from(ordersTable).where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.customerPhone, customerPhone), inArray(ordersTable.status, ["pending", "awaiting_payment", "payment_pending_confirmation", "confirmed"]))).orderBy(desc(ordersTable.createdAt));
      
      if (activeUnpaidOrders.length > 0) {
        const order = activeUnpaidOrders[0];
        return {
           text: `You have an existing order (#${order.shortId}) that is still in progress. Would you like to check its status, or cancel it to start a new one?`,
           buttons: [
             { id: `status`, title: "Check Status" },
             { id: `cancel_order_${order.shortId}`, title: "Cancel Old Order" }
           ],
           ruleMatched: "customer_existing_order_reminder"
        };
      }

      const menuResult = await buildMenuMessage(vendor);
      return { text: `${vendor.welcomeMessage || "Welcome to " + vendor.name + "!"}\n\n${menuResult.text}`, list: menuResult.list, ruleMatched: "customer_greeting" };
    }

    if (normalized.startsWith("cancel_order_")) {
      const shortId = normalized.replace("cancel_order_", "");
      const res = await toolRegistry.execute(vendor, customerPhone, { tool_name: "cancel_order", arguments: { order_id: shortId } });
      await clearPendingOrder(vendor.id, customerPhone);
      return { text: `${res.message}\n\nReply *menu* to start a new order.`, ruleMatched: "customer_cancel_old_order" };
    }

    const confirmations = ["yes", "y", "yeah", "yea", "yep", "yup", "ok", "okay", "k", "kk", "sure", "confirm", "confirmed", "alright", "aight", "correct", "that's correct", "that's right", "go ahead", "proceed", "ok o", "e correct", "na so", "abeg go ahead", "checkout"];
    if (confirmations.includes(normalized)) {
      const pending = await getPendingOrder(vendor.id, customerPhone);
      if (pending && pending.order && pending.order.resolvedItems && pending.order.resolvedItems.length > 0) {
        if (!pending.order.pendingClarification) {
          const acceptedMethods = vendor.acceptedPaymentMethods || ["bank_transfer", "cash_on_delivery", "pos"];
          const buttons = acceptedMethods.slice(0, 3).map((m: string) => {
             const titles: Record<string, string> = { "bank_transfer": "Bank Transfer", "cash_on_delivery": "Cash on Delivery", "pos": "POS Terminal" };
             return { id: `pay_${m}`, title: titles[m] || m };
          });
          await setPendingOrder(vendor.id, customerPhone, pending.order.resolvedItems, { originalText: "awaiting_payment_type", quantity: 1, candidates: [], remaining: [] }, pending.order.total);
          return { text: "How would you like to pay?", buttons, ruleMatched: "customer_checkout_payment" };
        }
      }
    }

    if (normalized.startsWith("pay_")) {
      const pending = await getPendingOrder(vendor.id, customerPhone);
      if (pending && pending.order && pending.order.pendingClarification?.originalText === "awaiting_payment_type") {
        const paymentType = normalized.replace("pay_", "");
        
        // Update clarification to store payment type
        const clarification = pending.order.pendingClarification;
        clarification.remaining = [{ text: paymentType, quantity: 1 }]; // store payment type here
        
        if (vendor.deliveryAvailable && vendor.pickupAvailable) {
           clarification.originalText = "awaiting_delivery_type";
           await setPendingOrder(vendor.id, customerPhone, pending.order.resolvedItems, clarification, pending.order.total);
           return { 
             text: "Awesome! Would you like *Delivery* or *Pickup*?",
             buttons: [ { id: "delivery", title: "Delivery" }, { id: "pickup", title: "Pickup" } ],
             ruleMatched: "customer_checkout_delivery_type"
           };
        } else {
           const deliveryType = vendor.deliveryAvailable ? "delivery" : "pickup";
           const res = await toolRegistry.execute(vendor, customerPhone, { tool_name: "confirm_order", arguments: { delivery_type: deliveryType, payment_type: paymentType } });
           return { text: res.message || "Order confirmed", ruleMatched: "customer_confirmation" };
        }
      }
    }

    const deliveryTypes = ["delivery", "pickup", "pick up"];
    if (deliveryTypes.includes(normalized)) {
      const pending = await getPendingOrder(vendor.id, customerPhone);
      if (pending && pending.order && pending.order.pendingClarification?.originalText === "awaiting_delivery_type") {
        const paymentType = pending.order.pendingClarification.remaining[0]?.text || "unknown";
        if (normalized === "delivery" || normalized === "delivery") {
          const locations = vendor.deliveryLocations && vendor.deliveryLocations.length > 0 ? vendor.deliveryLocations.join(", ") : "your address";
          const clarification = pending.order.pendingClarification;
          clarification.originalText = "awaiting_delivery_location";
          await setPendingOrder(vendor.id, customerPhone, pending.order.resolvedItems, clarification, pending.order.total);
          return { text: `We deliver to: ${locations}.\nWhere are you located? Please provide your delivery address.`, ruleMatched: "customer_checkout_delivery_location" };
        } else {
           const res = await toolRegistry.execute(vendor, customerPhone, { tool_name: "confirm_order", arguments: { delivery_type: "pickup", payment_type: paymentType } });
           return { text: res.message || "Order confirmed", ruleMatched: "customer_confirmation" };
        }
      }
    }

    const negatives = ["no", "n", "nope", "nah", "cancel", "stop", "don't", "dont", "never mind", "nevermind", "no o", "abeg no", "make we no do am"];

    const pendingCheck = await getPendingOrder(vendor.id, customerPhone);
    if (pendingCheck && pendingCheck.order && pendingCheck.order.pendingClarification?.originalText === "awaiting_delivery_location" && !negatives.includes(normalized) && normalized !== "cancel") {
       const paymentType = pendingCheck.order.pendingClarification.remaining[0]?.text || "unknown";
       const res = await toolRegistry.execute(vendor, customerPhone, { tool_name: "confirm_order", arguments: { delivery_type: "delivery", delivery_address: message, payment_type: paymentType } });
       return { text: res.message || "Order confirmed", ruleMatched: "customer_confirmation_delivery" };
    }

    if (negatives.includes(normalized) || message === "cancel") {
      const pending = await getPendingOrder(vendor.id, customerPhone);
      if (pending && pending.order) {
        await clearPendingOrder(vendor.id, customerPhone);
        return { text: "Your pending order has been cancelled. Let me know if you need anything else.", ruleMatched: "customer_negative_cancel" };
      }
    }

    const paymentClaims = ["paid", "i've paid", "i have paid", "ive paid", "payment done", "payment made", "payment sent", "sent payment", "just paid", "money sent", "don pay", "i don pay", "i don send am", "i just send am", "transfer don enter", "don transfer"];
    if (paymentClaims.includes(normalized)) {
      const [latestOrder] = await db.select().from(ordersTable).where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.customerPhone, customerPhone), eq(ordersTable.status, "confirmed"))).orderBy(desc(ordersTable.createdAt)).limit(1);
      if (latestOrder) {
        if (vendor.adminNumber && vendor.phoneNumberId) {
          await queueOutboundMessage(
            vendor.phoneNumberId, 
            vendor.adminNumber, 
            `Customer ${customerPhone} claims they have paid for order #${latestOrder.shortId}.`,
            undefined,
            [
              { id: `paid ${latestOrder.shortId}`, title: "Confirm Payment" },
              { id: `not_paid ${latestOrder.shortId}`, title: "Not Received" }
            ],
            undefined,
            undefined,
            incomingMessageId
          );
        }
        return { text: "Thanks! We've notified the vendor. They will confirm your payment shortly.", ruleMatched: "customer_payment_claim" };
      }
    }

    const paymentDetailsReq = ["account details", "what's the account number again", "whats the account number again", "account number", "how to pay", "where to pay"];
    if (paymentDetailsReq.includes(normalized)) {
       const activeOrders = await db.select().from(ordersTable).where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.customerPhone, customerPhone), eq(ordersTable.status, "awaiting_payment"))).orderBy(desc(ordersTable.createdAt));
       if (activeOrders.length > 0) {
         return { text: paymentInstructions(vendor, Number(activeOrders[0].total)), ruleMatched: "customer_payment_instructions_resend" };
       }
    }

    const tracking = ["track", "track order", "track my order", "where is my order", "wetin dey happen to my order", "my order status", "order status", "status", "wetin be the update", "any update"];
    if (tracking.includes(normalized)) {
      const activeOrders = await db.select().from(ordersTable).where(and(eq(ordersTable.vendorId, vendor.id), eq(ordersTable.customerPhone, customerPhone), notInArray(ordersTable.status, ["delivered", "rejected", "cancelled"]))).orderBy(desc(ordersTable.createdAt));
      
      if (activeOrders.length === 0) {
        return { text: "You don't have an active order right now.", ruleMatched: "customer_order_tracking" };
      }
      
      if (activeOrders.length > 1) {
        const orderList = activeOrders.map(o => `- #${o.shortId} (${o.status})`).join("\n");
        return { text: `You have multiple active orders. Which one are you asking about?\n${orderList}`, ruleMatched: "customer_order_tracking" };
      }
      
      const order = activeOrders[0];
      let response = "";
      if (order.status === "pending") response = `Your order #${order.shortId} is still awaiting confirmation from the vendor.`;
      else if (order.status === "awaiting_payment") response = `Your order #${order.shortId} is confirmed! Please complete payment:\n\n${paymentInstructions(vendor, Number(order.total))}`;
      else if (order.status === "payment_pending_confirmation") response = `We're confirming your payment for order #${order.shortId} now.`;
      else if (order.status === "paid" || order.status === "confirmed") response = `Your order #${order.shortId} is being prepared. ${order.eta ? "ETA: " + order.eta : ""}`;
      else if (order.status === "on_the_way") response = `Your order #${order.shortId} is on the way! ${order.eta ? "ETA: " + order.eta : ""}`;
      
      if ((order.status === "paid" || order.status === "confirmed") && !order.eta && vendor.adminNumber && vendor.phoneNumberId) {
         await queueOutboundMessage(vendor.phoneNumberId, vendor.adminNumber, `Customer ${customerPhone} is asking for an ETA for order #${order.shortId}. Reply with "eta ${order.shortId} 15 mins"`, undefined, undefined, undefined, undefined, incomingMessageId);
      }
      
      return { text: response, ruleMatched: "customer_order_tracking" };
    }

    const help = ["help", "agent", "human", "talk to someone", "real person", "i need help", "i want to talk to person", "abeg call person", "i wan talk to human"];
    if (help.includes(normalized)) {
      await db.update(conversationsTable).set({ status: "human" }).where(and(eq(conversationsTable.vendorId, vendor.id), eq(conversationsTable.customerPhone, customerPhone)));
      return { text: "I've flagged this conversation for a human agent. They will reply as soon as possible.", ruleMatched: "customer_help" };
    }

    const restarts = ["restart", "start over", "start again", "cancel my order", "cancel order"];
    if (restarts.includes(normalized)) {
      await clearPendingOrder(vendor.id, customerPhone);
      return { text: "Okay, we've started over. Let me know what you need.", ruleMatched: "customer_restart" };
    }

  if (/^\d+$/.test(normalized)) {
    return null; 
  }

  return null;
}

export class ConversationManager {
  static async handleIncomingMessage(
    vendor: VendorRow,
    customerPhone: string,
    message: string,
    customerName?: string,
    receivedAt?: number,
    incomingMessageId?: string
  ): Promise<{ text: string | null; buttons?: any[]; list?: any }> {
    try {
      const isAdmin = await isAdminSender(vendor, customerPhone);
      
      const deterministicMatch = await tryDeterministicMatch(vendor, customerPhone, message, isAdmin, incomingMessageId);
      
      const conversation = await findOrCreateConversation(vendor, customerPhone, customerName || "Customer");
      await recordMessage(conversation.id, "in", isAdmin ? "vendor" : "customer", message);
      
      if (deterministicMatch) {
        logger.info({ phone: customerPhone, ruleMatched: deterministicMatch.ruleMatched, path: "deterministic" }, "Handled deterministically");
        if (deterministicMatch.text && vendor.phoneNumberId) {
          await queueOutboundMessage(
            vendor.phoneNumberId, 
            customerPhone, 
            deterministicMatch.text,
            undefined, 
            deterministicMatch.buttons, 
            deterministicMatch.list,
            { receivedAt: receivedAt || Date.now(), llmDuration: 0, dbDuration: 0 },
            incomingMessageId
          );
          await recordMessage(conversation.id, "out", "bot", deterministicMatch.text);
        }
        return deterministicMatch;
      }

      const memory = await loadContext(vendor, customerPhone, customerName);
      const systemPrompt = await buildSystemPrompt(vendor, memory);

      const llmStart = Date.now();
      const response = await llmService.generate(systemPrompt, message, { vendorId: vendor.id });
      const llmDuration = Date.now() - llmStart;

      if (!response) {
        throw new Error("Failed to generate LLM response.");
      }

      logger.info({ phone: customerPhone, path: "llm" }, "Handled via LLM");

      const dbStart = Date.now();
      const toolPromises = [];
      if (response.actions && response.actions.length > 0) {
        for (const action of response.actions) {
          toolPromises.push(toolRegistry.execute(vendor, customerPhone, action));
        }
      }

      const toolResults = await Promise.all(toolPromises).catch((err) => {
        logger.error({ err }, "Tool Execution Error");
        return [];
      });

      const dbDuration = Date.now() - dbStart;
      logger.info({ dbDuration, vendorId: vendor.id }, "DB Tool Writes Latency");

      let finalButtons = response.buttons;
      let finalList = response.list;
      for (const res of toolResults) {
        if (res && res.buttons) finalButtons = res.buttons;
        if (res && res.list) finalList = res.list;
      }

      let queuePromise = Promise.resolve();
      if (response.assistant_response && vendor.phoneNumberId) {
         queuePromise = queueOutboundMessage(
           vendor.phoneNumberId, 
           customerPhone, 
           response.assistant_response,
           undefined, 
           finalButtons, 
           finalList,
           { receivedAt: receivedAt || Date.now(), llmDuration, dbDuration },
           incomingMessageId
         );
         await recordMessage(conversation.id, "out", "bot", response.assistant_response);
      }
      
      await queuePromise;

      return { text: response.assistant_response, buttons: finalButtons, list: finalList };
    } catch (error: any) {
      logger.error({ errMessage: error?.message, stack: error?.stack, error }, "ConversationManager Error:");
      if (vendor.phoneNumberId) {
        await queueOutboundMessage(
          vendor.phoneNumberId, 
          customerPhone, 
          "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
          undefined,
          undefined,
          undefined,
          undefined,
          incomingMessageId
        );
      }
      return { text: "Error processing request." };
    }
  }
}
