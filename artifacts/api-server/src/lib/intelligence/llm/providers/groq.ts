import Groq from "groq-sdk";
import { ILLMProvider, ProviderConfig, ProviderStats, LLMProviderError } from "../types";
import { LLMResponse } from "../../types";
import { validateLLMResponse } from "../validation";
import { geminiResponseSchema } from "./gemini";

export class GroqProvider implements ILLMProvider {
  public name = "Groq";
  private client: Groq;
  
  private stats: ProviderStats = {
    status: "offline",
    failureCount: 0,
    successCount: 0,
    averageLatencyMs: 0
  };

  constructor(private config: ProviderConfig) {
    this.client = new Groq({ apiKey: this.config.apiKey });
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new LLMProviderError(this.name, "API Key is missing", 401, false);
    }
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
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new LLMProviderError(this.name, "Request Timeout", 408, true)), this.config.timeoutMs);
      });

      const requestPromise = this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { 
            role: "system", 
            content: systemPrompt + "\n\nRespond strictly with JSON matching this schema: " + JSON.stringify(geminiResponseSchema) 
          },
          { role: "user", content: userMessage }
        ],
        response_format: { type: "json_object" },
        temperature: this.config.temperature
      });

      const result = await Promise.race([requestPromise, timeoutPromise]);
      const jsonStr = result.choices[0]?.message?.content || "";
      
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

      const status = error.status || 500;
      const isTransient = status === 429 || status >= 500;
      throw new LLMProviderError(this.name, error.message, status, isTransient);
    }
  }
}
