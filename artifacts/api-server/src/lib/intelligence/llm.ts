import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { LLMResponse } from "./types";
import { logger } from "../logger";

import Groq from "groq-sdk";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

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

export async function processWithLLM(systemPrompt: string, userMessage: string): Promise<LLMResponse | null> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("LLM Timeout")), 10000);
    });

    const model = genAI.getGenerativeModel(
      { 
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt
      },
      { apiVersion: "v1beta" }
    );

    const llmCall = model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const result = await Promise.race([llmCall, timeoutPromise]);
    const jsonStr = result.response.text();
    return JSON.parse(jsonStr) as LLMResponse;
  } catch (error) {
    logger.error({ error }, "Gemini execution failed, attempting Groq fallback...");
    
    if (groqClient) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Groq Timeout")), 10000);
        });

        const groqCall = groqClient.chat.completions.create({
          model: "llama3-8b-8192",
          messages: [
            { 
              role: "system", 
              content: systemPrompt + "\n\nRespond strictly with JSON matching this schema: " + JSON.stringify(responseSchema) 
            },
            { role: "user", content: userMessage }
          ],
          response_format: { type: "json_object" }
        });

        const result = await Promise.race([groqCall, timeoutPromise]);
        const jsonStr = result.choices[0]?.message?.content || "";
        return JSON.parse(jsonStr) as LLMResponse;
      } catch (groqError) {
        logger.error({ error: groqError }, "Groq fallback execution failed");
        return null;
      }
    }
    
    return null;
  }
}
