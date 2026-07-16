import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { logger } from "./logger";

// Lazily initialize Gemini only if API key is present
let gemini: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!gemini) {
    gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return gemini;
}

export type ExtractedOrder = {
  item: string;
  quantity: number;
};

export type ExtractedAdminIntent = {
  intent: string;
  entities: Record<string, unknown>;
};

function parseJsonResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    throw new Error("Invalid JSON");
  }
}

async function runGemini(
  prompt: string,
  timeoutMs = 10000,
): Promise<string | null> {
  const client = getGeminiClient();
  if (!client) {
    logger.debug("GEMINI_API_KEY not set, skipping AI extraction");
    return null;
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("AI extraction timeout: exceeded 10 seconds"));
    }, timeoutMs);
  });

  try {
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
    const response = await Promise.race([
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
      timeoutPromise,
    ]);
    return response.response.text();
  } catch (err) {
    if (err instanceof Error && err.message.includes("timeout")) {
      logger.warn("AI extraction timeout, falling back");
    } else {
      logger.warn({ err }, "AI extraction failed");
    }
    return null;
  }
}

let groq: Groq | null = null;

function getGroqClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

async function runGroq(
  prompt: string,
  timeoutMs = 10000,
): Promise<string | null> {
  const client = getGroqClient();
  if (!client) {
    logger.debug("GROQ_API_KEY not set, skipping fallback AI extraction");
    return null;
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Groq AI extraction timeout: exceeded 10 seconds"));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
      }),
      timeoutPromise,
    ]);
    return response.choices[0]?.message?.content || null;
  } catch (err) {
    logger.warn({ err }, "Groq AI fallback failed");
    return null;
  }
}

async function runLLM(prompt: string, timeoutMs = 10000): Promise<string | null> {
  let content = await runGemini(prompt, timeoutMs);
  if (!content) {
    logger.debug("Gemini failed or unavailable, falling back to Groq");
    content = await runGroq(prompt, timeoutMs);
  }
  return content;
}

/**
 * Attempts to extract order details using Gemini AI.
 * Returns null if the API is unavailable, times out, fails, or returns invalid JSON.
 */
export async function aiExtractOrder(
  text: string,
  menuItems?: Array<{ name: string; price: string }>,
  recentHistory?: Array<{ role: "customer" | "bot"; text: string }>,
): Promise<ExtractedOrder[] | null> {
  const menuContext = menuItems && menuItems.length > 0
    ? `\n\nAvailable menu items:\n${menuItems.map((m) => `- ${m.name} (${m.price})`).join("\n")}\n\nOnly extract items that closely match items from this menu.`
    : "";
  const historyContext = recentHistory && recentHistory.length > 0
    ? `\n\nRecent conversation for context:\n${recentHistory.map((m) => `${m.role === "customer" ? "Customer" : "Bot"}: ${m.text}`).join("\n")}\n\nBased on the entire conversation, determine the FULL and FINAL order the customer wants.`
    : "";
  const prompt = `Extract food order details from this customer message. Return ONLY valid JSON. Use this exact shape:\n{\n  "items": [\n    { "item": "<product name exactly as on menu>", "quantity": <integer> }\n  ]\n}\nIf you cannot extract any order items, return null. If the customer is modifying an existing order, output the complete updated order.${menuContext}${historyContext}\n\nCustomer message: ${text}`;

  const content = await runLLM(prompt);
  if (!content) return null;

  logger.debug({ aiResponse: content }, "AI order extraction response");

  try {
    const parsed = parseJsonResponse(content);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as any).items)
    ) {
      logger.debug({ parsed }, "AI order response missing items array");
      return null;
    }

    const items = (parsed as any).items;
    const result: ExtractedOrder[] = [];

    for (const raw of items) {
      if (
        !raw ||
        typeof raw !== "object" ||
        typeof raw.item !== "string" ||
        raw.item.trim() === ""
      ) {
        return null;
      }
      const quantity = Number(raw.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return null;
      }
      result.push({ item: raw.item.trim(), quantity });
    }

    return result.length > 0 ? result : null;
  } catch (err) {
    logger.warn({ err }, "AI order extraction invalid JSON");
    return null;
  }
}

/**
 * Attempts to extract admin intent and entities using Gemini AI.
 * Returns null if the API is unavailable, times out, fails, or returns invalid JSON.
 */
export async function aiExtractAdminIntent(
  text: string,
  recentHistory?: Array<{ role: "admin" | "bot"; text: string }>,
): Promise<ExtractedAdminIntent | null> {
  const historyContext = recentHistory && recentHistory.length > 0
    ? `\n\nRecent conversation for context:\n${recentHistory.map((m) => `${m.role === "admin" ? "Vendor" : "Bot"}: ${m.text}`).join("\n")}\n\nNow analyze the LATEST message below.`
    : "";
  const prompt = `Analyze this vendor message and return ONLY valid JSON in the form {"intent":"<intent>","entities":{...}}. Allowed intents: add_menu_item, remove_menu_item, update_price, mark_unavailable, mark_available, show_menu, confirm_order, reject_order, confirm_payment, switch_human, switch_bot, provide_eta. Use entity names such as itemName, price, orderId, customerPhone, eta. If the intent is unclear, return {"intent":"unknown","entities":{}}. Do not include any extra text.${historyContext}\n\nMessage: ${text}`;

  const content = await runLLM(prompt);
  if (!content) return null;

  logger.debug({ aiResponse: content }, "AI admin intent response");

  try {
    const parsed = parseJsonResponse(content);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as any).intent !== "string" ||
      typeof (parsed as any).entities !== "object"
    ) {
      logger.debug({ parsed }, "AI admin intent response invalid shape");
      return null;
    }

    return {
      intent: (parsed as any).intent,
      entities: (parsed as any).entities,
    };
  } catch (err) {
    logger.warn({ err }, "AI admin intent invalid JSON");
    return null;
  }
}

export type CustomerIntent = {
  intent: "order" | "menu" | "status" | "price_inquiry" | "timing_inquiry" | "help" | "track_order" | "paid_order" | "unknown";
  confidence: number;  // 0-1
};

/**
 * Detect customer intent from ambiguous messages
 * Helps the bot interpret messages like "how much is the rice?" or "when will my food arrive?"
 */
export async function detectCustomerIntent(
  text: string,
  menuItems?: Array<{ name: string; price: string }>,
): Promise<CustomerIntent | null> {
  const menuContext = menuItems && menuItems.length > 0
    ? `\n\nAvailable menu items:\n${menuItems.map((m) => `- ${m.name} (${m.price})`).join("\n")}`
    : "";
  
  const prompt = `Analyze this customer message and return ONLY valid JSON in the form {"intent":"<intent>","confidence":<0-1>}. 
Possible intents: "order" (wants to order items), "menu" (wants to see/ask about menu), "status" (asking about order status), "price_inquiry" (asking about prices), "timing_inquiry" (asking delivery/preparation time), "track_order" (tracking an existing order), "paid_order" (saying they have paid), "help" (needs help), "unknown" (unclear).${menuContext}

Return JSON like: {"intent":"menu","confidence":0.95}

Message: ${text}`;

  const content = await runLLM(prompt);
  if (!content) return null;

  try {
    const parsed = parseJsonResponse(content) as any;
    if (!parsed || typeof parsed.intent !== "string" || typeof parsed.confidence !== "number") {
      return null;
    }

    return {
      intent: parsed.intent as CustomerIntent["intent"],
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
    };
  } catch (err) {
    logger.warn({ err }, "Customer intent detection failed");
    return null;
  }
}

/**
 * Generates a natural language response to customer questions using AI.
 * Useful for handling FAQ, casual chat, and general inquiries.
 */
export async function generateChatResponse(
  text: string,
  vendor: { name: string; currency: string },
  menuItems: Array<{ name: string; price: string }>,
  recentHistory: Array<{ role: "customer" | "bot"; text: string }>,
): Promise<string | null> {
  const menuContext = menuItems && menuItems.length > 0
    ? `\n\nAvailable menu items:\n${menuItems.map((m) => `- ${m.name} (${m.price})`).join("\n")}`
    : "No menu available currently.";

  const historyContext = recentHistory && recentHistory.length > 0
    ? `\n\nRecent conversation:\n${recentHistory.map((m) => `${m.role === "customer" ? "Customer" : "You"}: ${m.text}`).join("\n")}`
    : "";

  const prompt = `You are a helpful and friendly AI assistant representing ${vendor.name} on WhatsApp.
Your goal is to answer the customer's message naturally and conversationally.
You should keep your answers short (1-3 sentences) since this is WhatsApp.
You can answer questions about the menu, prices, and general inquiries.
If the customer wants to order, politely acknowledge their request and guide them to select items from the menu.
Do not invent prices or items that are not on the menu.
Prices are in ${vendor.currency}.

${menuContext}
${historyContext}

Customer's latest message: ${text}

Reply directly as the bot. No JSON, just the text response.`;

  const content = await runLLM(prompt);
  return content;
}
