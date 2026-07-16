import { VendorRow } from "@workspace/db";
import { loadContext } from "./memory";
import { buildSystemPrompt } from "./context";
import { processWithLLM } from "./llm";
import { toolRegistry } from "./tools";
import { logger } from "../logger";
import { queueOutboundMessage } from "../queue";

export class ConversationManager {
  
  static async handleIncomingMessage(
    vendor: VendorRow,
    customerPhone: string,
    message: string
  ): Promise<void> {
    
    // Check for system commands
    if (message.startsWith("/admin") || message.startsWith("/debug") || message.startsWith("/reset")) {
      logger.info("System command detected. Bypassing LLM.");
      // Handle system commands directly (legacy style)
      return;
    }

    try {
      // 1. Gather context
      const memory = await loadContext(vendor, customerPhone);

      // 2. Build Prompt
      const systemPrompt = await buildSystemPrompt(vendor, memory);

      // 3. Query LLM
      const response = await processWithLLM(systemPrompt, message);

      if (!response) {
        throw new Error("Failed to generate LLM response.");
      }

      // 4. Validate & Execute Tools
      const toolResults = [];
      if (response.actions && response.actions.length > 0) {
        for (const action of response.actions) {
          const result = await toolRegistry.execute(vendor, customerPhone, action);
          toolResults.push(result);
        }
      }

      // 5. Check if we need to loop back to LLM with tool results (Not implemented in this basic phase)
      
      // 6. Queue Outbound Response
      if (response.assistant_response && vendor.phoneNumberId) {
         await queueOutboundMessage(vendor.phoneNumberId, customerPhone, response.assistant_response);
      }
      
    } catch (error) {
      logger.error({ error }, "ConversationManager Error:");
      if (vendor.phoneNumberId) {
        await queueOutboundMessage(
          vendor.phoneNumberId, 
          customerPhone, 
          "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment."
        );
      }
    }
  }
}
