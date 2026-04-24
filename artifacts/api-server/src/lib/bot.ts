import { db } from "@workspace/db";
import {
  vendorsTable,
  type VendorRow,
  menuItemsTable,
  ordersTable,
  type OrderItemJson,
  conversationsTable,
  type ConversationRow,
  messagesTable,
  customersTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export type IncomingResult = {
  conversation: ConversationRow;
  botReply: string | null;
};

const greetingTriggers = ["hi", "hello", "hey", "start", "menu", "hola"];
const menuTriggers = ["menu", "list", "items", "products", "show"];
const orderTriggers = ["order", "buy", "want", "i'd like", "id like", "get me"];
const payTriggers = [
  "pay",
  "payment",
  "paid",
  "transferred",
  "bank",
  "account",
];
const agentTriggers = [
  "agent",
  "human",
  "person",
  "staff",
  "help me",
  "support",
];
const helpTriggers = ["help", "?", "commands", "options"];

function startsWithAny(body: string, triggers: string[]) {
  const lower = body.trim().toLowerCase();
  return triggers.some((t) => lower === t || lower.startsWith(t + " "));
}

function includesAny(body: string, triggers: string[]) {
  const lower = body.toLowerCase();
  return triggers.some((t) => lower.includes(t));
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

async function buildMenuMessage(vendor: VendorRow): Promise<string> {
  const items = await db
    .select()
    .from(menuItemsTable)
    .where(
      and(
        eq(menuItemsTable.vendorId, vendor.id),
        eq(menuItemsTable.available, true),
      ),
    );

  if (items.length === 0) {
    return `Our menu is being updated. Please check back soon.`;
  }

  const grouped: Record<string, typeof items> = {};
  for (const item of items) {
    const key = item.category ?? "Menu";
    grouped[key] ??= [];
    grouped[key].push(item);
  }

  const lines: string[] = [`*${vendor.name} — Menu*`, ""];
  for (const [cat, list] of Object.entries(grouped)) {
    lines.push(`*${cat}*`);
    for (const item of list) {
      lines.push(
        `- ${item.name} — ${formatMoney(Number(item.price), vendor.currency)}`,
      );
    }
    lines.push("");
  }
  lines.push(
    `Reply with *order <item> x<qty>* (e.g. "order Margherita x2") to place an order.`,
  );
  return lines.join("\n");
}

function parseOrderLine(
  body: string,
): Array<{ name: string; quantity: number }> {
  const text = body.replace(/^order\s+/i, "").trim();
  if (!text) return [];
  const parts = text.split(/[,;]| and /i).map((s) => s.trim()).filter(Boolean);
  const result: Array<{ name: string; quantity: number }> = [];
  for (const part of parts) {
    const match = part.match(/^(.*?)(?:\s*[x×]\s*(\d+))?$/i);
    if (!match) continue;
    const name = match[1]!.trim();
    const qty = match[2] ? parseInt(match[2], 10) : 1;
    if (name) result.push({ name, quantity: qty });
  }
  return result;
}

function paymentInstructions(vendor: VendorRow, total: number): string {
  if (vendor.bankName && vendor.bankAccountNumber) {
    return [
      `*Payment instructions*`,
      `Total: ${formatMoney(total, vendor.currency)}`,
      `Bank: ${vendor.bankName}`,
      `Account: ${vendor.bankAccountNumber}`,
      vendor.bankAccountHolder ? `Holder: ${vendor.bankAccountHolder}` : null,
      ``,
      `After paying, reply *paid* and we will confirm.`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return `Total: ${formatMoney(total, vendor.currency)}. Reply *paid* once you have completed payment.`;
}

async function findOrCreateConversation(
  vendor: VendorRow,
  customerPhone: string,
  customerName: string,
): Promise<ConversationRow> {
  const existing = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.vendorId, vendor.id),
        eq(conversationsTable.customerPhone, customerPhone),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(conversationsTable)
    .values({
      vendorId: vendor.id,
      customerPhone,
      customerName,
    })
    .returning();
  return created!;
}

async function upsertCustomer(
  vendorId: string,
  phone: string,
  name: string,
): Promise<void> {
  await db
    .insert(customersTable)
    .values({ vendorId, phone, name, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [customersTable.vendorId, customersTable.phone],
      set: { name, lastSeenAt: new Date() },
    });
}

async function recordMessage(
  conversationId: string,
  direction: "in" | "out",
  sender: "customer" | "bot" | "vendor" | "system",
  body: string,
): Promise<void> {
  await db
    .insert(messagesTable)
    .values({ conversationId, direction, sender, body });
  const preview = body.length > 80 ? body.slice(0, 77) + "..." : body;
  await db
    .update(conversationsTable)
    .set({
      lastMessagePreview: preview,
      lastMessageAt: new Date(),
      ...(direction === "in"
        ? { unreadCount: sql`${conversationsTable.unreadCount} + 1` }
        : {}),
    })
    .where(eq(conversationsTable.id, conversationId));
}

export async function handleIncomingMessage(args: {
  vendor: VendorRow;
  customerPhone: string;
  customerName: string;
  body: string;
}): Promise<IncomingResult> {
  const { vendor, customerPhone, customerName, body } = args;

  await upsertCustomer(vendor.id, customerPhone, customerName);
  const conversation = await findOrCreateConversation(
    vendor,
    customerPhone,
    customerName,
  );

  await recordMessage(conversation.id, "in", "customer", body);

  // Bot stays silent during human handover or when bot is disabled.
  if (
    !vendor.botEnabled ||
    conversation.status === "human" ||
    conversation.status === "closed"
  ) {
    return { conversation, botReply: null };
  }

  const reply = await computeBotReply(vendor, conversation, body);
  if (reply.handover) {
    await db
      .update(conversationsTable)
      .set({ status: "human" })
      .where(eq(conversationsTable.id, conversation.id));
  }

  if (reply.text) {
    await recordMessage(conversation.id, "out", "bot", reply.text);
  }
  return { conversation, botReply: reply.text };
}

type BotReply = { text: string | null; handover: boolean };

async function computeBotReply(
  vendor: VendorRow,
  conversation: ConversationRow,
  body: string,
): Promise<BotReply> {
  // Human handover request
  if (includesAny(body, agentTriggers)) {
    return {
      text: `Connecting you to a human agent now. Someone will reply here shortly.`,
      handover: true,
    };
  }

  // Help / commands
  if (startsWithAny(body, helpTriggers)) {
    return {
      text: [
        `I can help you with:`,
        `- *menu* — see what's available`,
        `- *order <item> x<qty>* — place an order`,
        `- *paid* — confirm a payment`,
        `- *agent* — talk to a human`,
      ].join("\n"),
      handover: false,
    };
  }

  // "paid" -> mark latest pending order as paid (vendor will confirm)
  if (startsWithAny(body, ["paid"]) || /^i.?ve paid/i.test(body)) {
    const pending = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.vendorId, vendor.id),
          eq(ordersTable.customerPhone, conversation.customerPhone),
          eq(ordersTable.status, "confirmed"),
        ),
      )
      .orderBy(sql`${ordersTable.createdAt} DESC`)
      .limit(1);
    const target = pending[0];
    if (!target) {
      return {
        text: `We don't see a confirmed order awaiting payment. Reply *menu* to start a new order.`,
        handover: false,
      };
    }
    await db
      .update(ordersTable)
      .set({ status: "paid" })
      .where(eq(ordersTable.id, target.id));
    return {
      text: `Thanks. We've marked the payment as received and the vendor will confirm shortly.`,
      handover: false,
    };
  }

  // Order detection
  if (
    startsWithAny(body, orderTriggers) ||
    /\bx\s?\d+\b/i.test(body) ||
    /\b\d+\s+\w+/i.test(body.trim())
  ) {
    const requested = parseOrderLine(body);
    if (requested.length === 0) {
      return {
        text: `I didn't catch that. Try: *order <item> x<qty>* — for example "order Margherita x2".`,
        handover: false,
      };
    }
    const allItems = await db
      .select()
      .from(menuItemsTable)
      .where(
        and(
          eq(menuItemsTable.vendorId, vendor.id),
          eq(menuItemsTable.available, true),
        ),
      );
    const matched: OrderItemJson[] = [];
    const missing: string[] = [];
    for (const r of requested) {
      const found = allItems.find(
        (m) => m.name.toLowerCase() === r.name.toLowerCase(),
      ) ??
        allItems.find((m) =>
          m.name.toLowerCase().includes(r.name.toLowerCase()),
        );
      if (!found) {
        missing.push(r.name);
      } else {
        matched.push({
          name: found.name,
          quantity: r.quantity,
          unitPrice: Number(found.price),
        });
      }
    }
    if (matched.length === 0) {
      return {
        text: `I couldn't find ${missing.join(", ")} on the menu. Reply *menu* to see what's available.`,
        handover: false,
      };
    }
    const total = matched.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );
    const [order] = await db
      .insert(ordersTable)
      .values({
        vendorId: vendor.id,
        customerPhone: conversation.customerPhone,
        customerName: conversation.customerName,
        status: "pending",
        total: total.toFixed(2),
        currency: vendor.currency,
        items: matched,
        notes: missing.length > 0 ? `Not on menu: ${missing.join(", ")}` : null,
      })
      .returning();
    const lines: string[] = [`*Order received*`, ``];
    for (const item of matched) {
      lines.push(
        `- ${item.quantity}× ${item.name} — ${formatMoney(item.unitPrice * item.quantity, vendor.currency)}`,
      );
    }
    lines.push(``, `Total: *${formatMoney(total, vendor.currency)}*`);
    if (missing.length > 0) {
      lines.push(``, `Not on menu: ${missing.join(", ")}`);
    }
    lines.push(
      ``,
      `The vendor will confirm shortly. Order #${order!.id.slice(0, 8)}.`,
    );
    return { text: lines.join("\n"), handover: false };
  }

  // Menu request
  if (startsWithAny(body, menuTriggers)) {
    return { text: await buildMenuMessage(vendor), handover: false };
  }

  // Greeting / welcome
  if (startsWithAny(body, greetingTriggers)) {
    const welcome =
      vendor.welcomeMessage ??
      `Welcome to ${vendor.name}. Reply *menu* to see what's available.`;
    return { text: welcome, handover: false };
  }

  // Fallback
  return {
    text: [
      `I'm not sure I understood. Try:`,
      `- *menu* to see what we offer`,
      `- *order <item> x<qty>* to order`,
      `- *agent* to reach a human`,
    ].join("\n"),
    handover: false,
  };
}

export async function notifyOrderConfirmedToCustomer(args: {
  vendor: VendorRow;
  conversationId: string;
  total: number;
}): Promise<string> {
  const text = paymentInstructions(args.vendor, args.total);
  await recordMessage(args.conversationId, "out", "bot", text);
  return text;
}
