import CircuitBreaker from "opossum";
import { logger } from "./logger";

/**
 * circuit-breaker.ts
 * Prevents cascading failures when external services (like Gemini) are degraded.
 * 
 * Behavior:
 * - If 50% of recent requests fail, "open" the circuit
 * - Fail fast for new requests until cooldown period expires
 * - Gradually allow requests again with "half-open" state
 */

export interface CircuitBreakerOptions {
  timeout?: number;           // How long to wait before timing out (ms)
  errorThresholdPercentage?: number;  // % of failures before opening
  resetTimeout?: number;      // How long to wait before trying again (ms)
  rollingCountTimeout?: number;  // Window for counting failures (ms)
  rollingCountBuckets?: number;  // Number of buckets in rolling window
}

const defaultOptions: Required<CircuitBreakerOptions> = {
  timeout: 5000,              // 5 second timeout per request
  errorThresholdPercentage: 50,  // Open after 50% failures
  resetTimeout: 30000,        // Try again after 30 seconds
  rollingCountTimeout: 10000, // 10 second rolling window
  rollingCountBuckets: 10,    // 1 second per bucket
};

/**
 * Create an AI-specific circuit breaker
 * Falls open quickly to prevent cascading delays
 */
export function createAICircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {},
) {
  const opts = { ...defaultOptions, ...options };

  const breaker = new CircuitBreaker(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    rollingCountTimeout: opts.rollingCountTimeout,
    rollingCountBuckets: opts.rollingCountBuckets,
    fallback: () => {
      logger.warn("Circuit breaker fallback: AI service unavailable");
      return null as any;
    },
  });

  breaker.on("open", () => {
    logger.warn("Circuit breaker OPENED: AI service degraded, fast-failing requests");
  });

  breaker.on("halfOpen", () => {
    logger.info("Circuit breaker HALF-OPEN: Testing AI service recovery");
  });

  breaker.on("close", () => {
    logger.info("Circuit breaker CLOSED: AI service recovered");
  });

  return breaker;
}

/**
 * Create a WhatsApp-specific circuit breaker
 * More forgiving since WhatsApp API is usually reliable
 */
export function createWhatsAppCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {},
) {
  const opts = {
    ...defaultOptions,
    timeout: 10000,            // 10 second timeout (more lenient)
    errorThresholdPercentage: 80,  // Only open after 80% failures
    resetTimeout: 60000,       // Wait longer before retry
    ...options,
  };

  const breaker = new CircuitBreaker(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    rollingCountTimeout: opts.rollingCountTimeout,
    rollingCountBuckets: opts.rollingCountBuckets,
    fallback: () => {
      logger.error("Circuit breaker fallback: WhatsApp service unavailable");
      throw new Error("WhatsApp service temporarily unavailable");
    },
  });

  breaker.on("open", () => {
    logger.error("Circuit breaker OPENED: WhatsApp service degraded");
  });

  breaker.on("halfOpen", () => {
    logger.warn("Circuit breaker HALF-OPEN: Testing WhatsApp service recovery");
  });

  breaker.on("close", () => {
    logger.info("Circuit breaker CLOSED: WhatsApp service recovered");
  });

  return breaker;
}
