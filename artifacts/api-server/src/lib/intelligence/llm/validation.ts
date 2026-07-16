import { z } from "zod";
import { LLMResponse } from "../types";
import { logger } from "../../logger";

export const LLMResponseSchema = z.object({
  intent: z.enum(["create_order", "modify_order", "ask_question", "checkout", "admin_command", "greeting", "unknown"]),
  actions: z.array(z.object({
    tool_name: z.string(),
    arguments: z.any()
  })).optional(),
  missing_information: z.array(z.string()).optional(),
  assistant_response: z.string(),
  confidence: z.number().min(0).max(1)
});

export function validateLLMResponse(data: unknown, providerName: string): LLMResponse {
  const result = LLMResponseSchema.safeParse(data);
  if (!result.success) {
    logger.error({ errors: result.error.issues, providerName }, "LLM Response Validation Failed");
    throw new Error(`Invalid response schema from ${providerName}`);
  }
  return result.data as LLMResponse;
}
