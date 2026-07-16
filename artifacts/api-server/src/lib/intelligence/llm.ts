import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { LLMResponse } from "./types";
import { logger } from "../logger";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const responseSchema = {
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
          arguments: { type: SchemaType.OBJECT } // We rely on the model for now to populate it
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

export async function processWithLLM(systemPrompt: string, userMessage: string): Promise<LLMResponse | null> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("LLM Timeout")), 10000);
    });

    const llmCall = model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const result = await Promise.race([llmCall, timeoutPromise]);
    const jsonStr = result.response.text();
    return JSON.parse(jsonStr) as LLMResponse;
  } catch (error) {
    logger.error({ error }, "LLM execution failed");
    return null;
  }
}
