import { ILLMProvider, LLMProviderError, ProviderStats } from "./types";
import { LLMResponse } from "../types";
import { GlobalLLMConfig } from "./config";
import { logger } from "../../logger";

export class LLMRouter {
  private primary: ILLMProvider;
  private fallback?: ILLMProvider;
  private isCircuitOpen = false;
  private circuitOpenTime = 0;
  private config: GlobalLLMConfig;

  constructor(primary: ILLMProvider, fallback: ILLMProvider | undefined, config: GlobalLLMConfig) {
    this.primary = primary;
    this.fallback = fallback;
    this.config = config;
  }

  async initialize() {
    try {
      await this.primary.initialize();
      logger.info(`[LLMRouter] Primary provider ${this.primary.name} initialized.`);
    } catch (err) {
      logger.error({ err }, `[LLMRouter] Primary provider ${this.primary.name} failed to initialize.`);
      throw err;
    }

    if (this.fallback) {
      try {
        await this.fallback.initialize();
        logger.info(`[LLMRouter] Fallback provider ${this.fallback.name} initialized.`);
      } catch (err) {
        logger.warn({ err }, `[LLMRouter] Fallback provider ${this.fallback.name} failed to initialize. Degraded mode.`);
      }
    }
  }

  private async executeWithRetries(
    provider: ILLMProvider, 
    systemPrompt: string, 
    userMessage: string, 
    maxRetries: number
  ): Promise<LLMResponse> {
    let attempts = 0;
    let lastError: any;

    while (attempts <= maxRetries) {
      try {
        return await provider.generate(systemPrompt, userMessage);
      } catch (error: any) {
        attempts++;
        lastError = error;

        const isTransient = error instanceof LLMProviderError && error.isTransient;
        
        if (!isTransient) {
          logger.warn({ error: error.message, provider: provider.name }, `[LLMRouter] Non-transient error, aborting retries for this provider.`);
          break; // Don't retry non-transient errors (like 404, 401)
        }
        
        if (attempts <= maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          const backoff = Math.pow(2, attempts - 1) * 1000;
          logger.warn({ attempt: attempts, backoff, provider: provider.name }, `[LLMRouter] Transient error, retrying...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError;
  }

  async generate(systemPrompt: string, userMessage: string, metadata: { conversationId?: string, vendorId?: string } = {}): Promise<LLMResponse> {
    const stats = this.primary.getStats();
    
    // Check circuit breaker recovery
    if (this.isCircuitOpen) {
      if (Date.now() - this.circuitOpenTime > this.config.circuitBreakerResetTimeoutMs) {
        logger.info(`[LLMRouter] Circuit breaker reset timeout reached. Attempting to close circuit and restore ${this.primary.name}.`);
        this.isCircuitOpen = false;
      }
    } else if (stats.failureCount >= this.config.circuitBreakerFailureThreshold) {
      // We only open the circuit if we have a fallback
      if (this.fallback) {
         logger.error(`[LLMRouter] Circuit breaker opened for ${this.primary.name} due to ${stats.failureCount} consecutive failures.`);
         this.isCircuitOpen = true;
         this.circuitOpenTime = Date.now();
      }
    }

    const activeProvider = this.isCircuitOpen && this.fallback ? this.fallback : this.primary;
    
    try {
      logger.info({ provider: activeProvider.name, ...metadata }, `[LLMRouter] Routing request...`);
      return await this.executeWithRetries(activeProvider, systemPrompt, userMessage, 2); // default max 2 retries per provider
    } catch (primaryError) {
      logger.error({ error: primaryError, provider: activeProvider.name }, `[LLMRouter] Active provider failed completely.`);
      
      // If primary failed and we haven't tried fallback yet, failover
      if (activeProvider === this.primary && this.fallback) {
        logger.warn({ fallback: this.fallback.name }, `[LLMRouter] Initiating failover...`);
        try {
          return await this.executeWithRetries(this.fallback, systemPrompt, userMessage, 2);
        } catch (fallbackError) {
          logger.error({ error: fallbackError, provider: this.fallback.name }, `[LLMRouter] Fallback provider also failed.`);
          throw fallbackError; // Both failed
        }
      }

      throw primaryError;
    }
  }

  getHealthStatus(): Record<string, ProviderStats> {
    const health: Record<string, ProviderStats> = {};
    health[this.primary.name] = this.primary.getStats();
    if (this.fallback) {
      health[this.fallback.name] = this.fallback.getStats();
    }
    return health;
  }
}
