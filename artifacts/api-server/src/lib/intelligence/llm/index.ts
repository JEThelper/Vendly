import { loadLLMConfig } from "./config";
import { GeminiProvider } from "./providers/gemini";
import { GroqProvider } from "./providers/groq";
import { LLMRouter } from "./router";

const config = loadLLMConfig();

const primary = config.gemini ? new GeminiProvider(config.gemini) : new GroqProvider(config.groq!);
const fallback = (config.gemini && config.groq) ? new GroqProvider(config.groq) : undefined;

export const llmService = new LLMRouter(primary, fallback, config);
