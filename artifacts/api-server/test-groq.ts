import { aiExtractOrder } from "./src/lib/ai-extractor.js";

async function run() {
  console.log("Testing order extraction via fallback LLM (Groq)...");
  const result = await aiExtractOrder("I want 2 margherita pizzas and 1 cold brew");
  console.log("Extraction Result:", JSON.stringify(result, null, 2));
}

run().catch(console.error);
