import { z } from "zod";

export const ActionSchema = z.object({
  tool_name: z.string(),
  arguments: z.record(z.any()),
});

export const LLMResponseSchema = z.object({
  intent: z.enum([
    "create_order",
    "modify_order",
    "ask_question",
    "checkout",
    "admin_command",
    "greeting",
    "unknown",
  ]),
  actions: z.array(ActionSchema).optional(),
  missing_information: z.array(z.string()).optional(),
  assistant_response: z.string(),
  buttons: z.array(z.object({ id: z.string(), title: z.string() })).optional(),
  list: z.object({
    buttonText: z.string(),
    sections: z.array(z.object({
      title: z.string(),
      rows: z.array(z.object({ id: z.string(), title: z.string(), description: z.string().optional() }))
    }))
  }).optional(),
  confidence: z.number().min(0).max(1),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type Action = z.infer<typeof ActionSchema>;

export interface MemoryContext {
  history: Array<{ role: "customer" | "bot"; text: string }>;
  workingState: any; 
  longTermMemory: any;
  businessRules: any;
  activeOrders: any[];
}
