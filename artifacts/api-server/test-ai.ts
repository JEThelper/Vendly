import { aiDetectOrderModification } from "./src/lib/ai-extractor";
import { runLLM } from "./src/lib/ai";

async function main() {
  const menuItems = [
    { name: "Jollof Rice", price: "2500" },
    { name: "Zobo", price: "500" }
  ];
  const currentOrderItems = [
    { item: "Jollof Rice", quantity: 1 }
  ];
  const text = "make it two portions and also add zobo";
  
  const result = await aiDetectOrderModification(text, menuItems, currentOrderItems);
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
