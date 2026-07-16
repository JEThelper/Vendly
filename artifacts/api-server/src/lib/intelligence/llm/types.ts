import { LLMResponse } from "../types";

export interface ProviderConfig {
  name: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  temperature?: number;
}

export interface ProviderStats {
  status: "healthy" | "degraded" | "offline";
  failureCount: number;
  successCount: number;
  lastError?: string;
  lastSuccess?: Date;
  averageLatencyMs: number;
}

export interface ILLMProvider {
  name: string;
  
  /**
   * Initializes the provider and validates credentials
   * Throws an error if invalid.
   */
  initialize(): Promise<void>;

  /**
   * Generates a structured response based on the system prompt and user message.
   */
  generate(systemPrompt: string, userMessage: string): Promise<LLMResponse>;

  /**
   * Returns current health and statistics of the provider.
   */
  getStats(): ProviderStats;
}

export class LLMProviderError extends Error {
  constructor(
    public providerName: string,
    message: string,
    public statusCode?: number,
    public isTransient: boolean = false
  ) {
    super(`[${providerName}] ${message}`);
    this.name = "LLMProviderError";
  }
}
