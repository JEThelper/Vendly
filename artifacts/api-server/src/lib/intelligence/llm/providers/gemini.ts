import { GoogleGenerativeAI, SchemaType, GenerateContentResult } from "@google/generative-ai";
import { ILLMProvider, ProviderConfig, ProviderStats, LLMProviderError } from "../types";
import { LLMResponse } from "../../types";
import { validateLLMResponse } from "../validation";

export const geminiResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    intent: {
      type: SchemaType.STRING,
      description: "The primary intent of the user",
      enum: ["create_order", "modify_order", "ask_question", "checkout", "admin_command", "greeting", "unknown"]
    },
    actions: {
      type: SchemaType.ARRAY,
      description: "List of tools to execute",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          tool_name: { type: SchemaType.STRING },
          arguments: { 
            type: SchemaType.OBJECT,
            properties: {
              query: { type: SchemaType.STRING, description: "Search query for menu" },
              item_id: { type: SchemaType.STRING, description: "ID of the menu item" },
              quantity: { type: SchemaType.NUMBER, description: "Quantity to add or update" },
              payment_method: { type: SchemaType.STRING, description: "cash or card" },
              delivery_type: { type: SchemaType.STRING, description: "pickup or delivery" },
              delivery_address: { type: SchemaType.STRING, description: "Address if delivery" }
            }
          }
        },
        required: ["tool_name", "arguments"]
      }
    },
    missing_information: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Any missing info needed to proceed"
    },
    assistant_response: {
      type: SchemaType.STRING,
      description: "The natural language response to send to the customer"
    },
    confidence: {
      type: SchemaType.NUMBER,
      description: "Confidence level of the response between 0 and 1"
    }
  },
  required: ["intent", "assistant_response", "confidence"]
};

export class GeminiProvider implements ILLMProvider {
  public name = "Gemini";
  private genAI: GoogleGenerativeAI;
  
  private stats: ProviderStats = {
    status: "offline",
    failureCount: 0,
    successCount: 0,
    averageLatencyMs: 0
  };

  constructor(private config: ProviderConfig) {
    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new LLMProviderError(this.name, "API Key is missing", 401, false);
    }
    // Simple verification (could be a model list call to verify auth)
    this.stats.status = "healthy";
  }

  getStats(): ProviderStats {
    return this.stats;
  }

  private updateLatency(durationMs: number) {
    if (this.stats.successCount === 0) {
      this.stats.averageLatencyMs = durationMs;
    } else {
      this.stats.averageLatencyMs = (this.stats.averageLatencyMs * this.stats.successCount + durationMs) / (this.stats.successCount + 1);
    }
  }

  async generate(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      const model = this.genAI.getGenerativeModel(
        { 
          model: this.config.model,
          systemInstruction: systemPrompt
        },
        { apiVersion: "v1beta" }
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new LLMProviderError(this.name, "Request Timeout", 408, true)), this.config.timeoutMs);
      });

      const requestPromise = model.generateContent({
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: geminiResponseSchema,
          temperature: this.config.temperature
        }
      });

      const result = (await Promise.race([requestPromise, timeoutPromise])) as GenerateContentResult;
      
      const jsonStr = result.response.text();
      let rawJson: unknown;
      try {
        rawJson = JSON.parse(jsonStr);
      } catch (e) {
        throw new LLMProviderError(this.name, "Failed to parse JSON response", 500, false);
      }

      const validResponse = validateLLMResponse(rawJson, this.name);
      
      this.stats.successCount++;
      this.stats.lastSuccess = new Date();
      this.stats.status = "healthy";
      this.updateLatency(Date.now() - startTime);

      return validResponse;
    } catch (error: any) {
      this.stats.failureCount++;
      this.stats.lastError = error.message;
      this.stats.status = this.stats.failureCount > 3 ? "degraded" : "healthy";
      
      if (error instanceof LLMProviderError) {
        throw error;
      }

      // Map GoogleGenerativeAI errors to LLMProviderError
      const status = error.status || error.response?.status || 500;
      const isTransient = status === 429 || status >= 500;
      throw new LLMProviderError(this.name, error.message, status, isTransient);
    }
  }
}
