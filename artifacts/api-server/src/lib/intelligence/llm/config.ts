import { z } from "zod";
import { logger } from "../../logger";

const ProviderConfigSchema = z.object({
  name: z.string(),
  model: z.string(),
  apiKey: z.string().min(1, "API Key is required"),
  timeoutMs: z.number().int().positive().default(10000),
  maxRetries: z.number().int().nonnegative().default(2),
  temperature: z.number().min(0).max(2).default(0.0), // Structured output performs best with 0
});

export const GlobalLLMConfigSchema = z.object({
  circuitBreakerFailureThreshold: z.number().int().positive().default(3),
  circuitBreakerResetTimeoutMs: z.number().int().positive().default(60000),
  gemini: ProviderConfigSchema.optional(),
  groq: ProviderConfigSchema.optional(),
});

export type GlobalLLMConfig = z.infer<typeof GlobalLLMConfigSchema>;

export function loadLLMConfig(): GlobalLLMConfig {
  const rawConfig = {
    circuitBreakerFailureThreshold: Number(process.env.LLM_CIRCUIT_BREAKER_THRESHOLD || 3),
    circuitBreakerResetTimeoutMs: Number(process.env.LLM_CIRCUIT_BREAKER_TIMEOUT || 60000),
    gemini: process.env.GEMINI_API_KEY ? {
      name: "Gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      apiKey: process.env.GEMINI_API_KEY,
      timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 5000), // Reduced from 10000 to 5000
      maxRetries: Number(process.env.GEMINI_MAX_RETRIES || 0), // Reduced from 2 to 0 to prefer fast failover
      temperature: 0.0,
    } : undefined,
    groq: process.env.GROQ_API_KEY ? {
      name: "Groq",
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      apiKey: process.env.GROQ_API_KEY,
      timeoutMs: Number(process.env.GROQ_TIMEOUT_MS || 5000), // Reduced from 10000 to 5000
      maxRetries: Number(process.env.GROQ_MAX_RETRIES || 0), // Reduced from 2 to 0
      temperature: 0.0,
    } : undefined,
  };

  const parsed = GlobalLLMConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    logger.error({ errors: parsed.error.issues }, "LLM Configuration Validation Failed");
    throw new Error("Invalid LLM Configuration");
  }

  if (!parsed.data.gemini && !parsed.data.groq) {
    const err = "No LLM providers configured. Must provide GEMINI_API_KEY or GROQ_API_KEY";
    logger.error(err);
    throw new Error(err);
  }

  return parsed.data;
}
