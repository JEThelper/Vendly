import OpenAI from "openai";
import { logger } from "./logger";
import { createAICircuitBreaker } from "./circuit-breaker";

// Lazily initialize OpenAI only if API key is present
let openai: OpenAI | null = null;
let aiCircuitBreaker: ReturnType<typeof createAICircuitBreaker> | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Add timeout to client configuration
      timeout: 5000,
    });
  }
  return openai;
}

function getAICircuitBreaker() {
  if (!aiCircuitBreaker) {
    const client = getOpenAIClient();
    if (client) {
      aiCircuitBreaker = createAICircuitBreaker(
        () => Promise.resolve(null), // Dummy function, will be replaced
        {
          timeout: 5000,
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
        },
      );
    }
  }
  return aiCircuitBreaker;
}

export type ExtractedOrder = {
  item: string;
  quantity: number;
};

/**
 * Attempts to extract order details using AI.
 * Returns null if:
 * - API key is not set (stub mode)
 * - API call times out (5 second limit)
 * - API fails (circuit breaker protection)
 * - Response is not valid JSON
 * - Response missing required fields
 * - Quantity is invalid
 * 
 * IMPORTANT: This function WILL NOT BLOCK indefinitely.
 * Even if OpenAI API hangs, we timeout after 5 seconds and fall back to rule-based.
 */
export async function aiExtractOrder(text: string): Promise<ExtractedOrder | null> {
  const client = getOpenAIClient();

  // Fail safely: no API key = stub mode
  if (!client) {
    logger.debug("OPENAI_API_KEY not set, skipping AI extraction");
    return null;
  }

  try {
    // Wrap in timeout promise to ensure we never wait forever
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("AI extraction timeout: exceeded 5 seconds"));
      }, 5000);
    });

    const response = await Promise.race([
      client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Extract food order details from user message. Return ONLY valid JSON with 'item' (product name) and 'quantity' (number >= 1) fields. Example: {\"item\": \"pizza\", \"quantity\": 2}. If you cannot extract, return null.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
      timeoutPromise,
    ]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.debug("AI returned empty response");
      return null;
    }

    logger.debug({ aiResponse: content }, "AI extraction response");

    // Parse JSON (AI might wrap it in markdown code blocks)
    let parsed: unknown;
    try {
      // Try direct parse first
      parsed = JSON.parse(content);
    } catch {
      // Try extracting from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Invalid JSON");
      }
    }

    // Validate structure
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("item" in parsed) ||
      !("quantity" in parsed)
    ) {
      logger.debug({ parsed }, "AI response missing required fields");
      return null;
    }

    const item = String(parsed.item).trim();
    const quantity = Number(parsed.quantity);

    if (!item || quantity < 1 || !Number.isInteger(quantity)) {
      logger.debug({ item, quantity }, "AI response has invalid values");
      return null;
    }

    return { item, quantity };
  } catch (err) {
    // Check if it's a timeout error
    if (err instanceof Error && err.message.includes("timeout")) {
      logger.warn({ text: text.slice(0, 100) }, "AI extraction timeout, using rule-based fallback");
    } else {
      logger.warn({ err }, "AI extraction failed, will fallback to rule-based");
    }
    return null;
  }
}
