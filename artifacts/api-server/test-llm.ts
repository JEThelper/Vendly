import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI("test_fake_api_key_123");
const model = genAI.getGenerativeModel({ model: "gemini-nonexistent" });
async function main() {
  try {
    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    } as any);
  } catch (err: any) {
    console.error(err.status, err.message, err.statusText);
  }
}
main();
