// config removed
import { incomingQueue, outboundQueue, queueIncomingMessage } from "./src/lib/queue";
import { setupQueueWorkers } from "./src/lib/queue-workers";
import { db } from "@workspace/db";
import { vendorsTable } from "@workspace/db";
import { llmService } from "./src/lib/intelligence/llm/index";
import { checkIdempotencyKey } from "./src/lib/idempotency";

const originalGenerate = llmService.generate.bind(llmService);
llmService.generate = async (...args) => {
  console.log("Mock LLM sleeping for 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log("Mock LLM woke up!");
  return originalGenerate(...args);
};

// We will force bull to process it and stall
async function run() {
  await incomingQueue.empty();
  await outboundQueue.empty();

  await setupQueueWorkers();

  const [vendor] = await db.select().from(vendorsTable).limit(1);
  if (!vendor) throw new Error("No vendor");

  console.log("Queueing incoming message...");
  const msgId = "msg_test_stall_" + Date.now();
  // Call once
  await queueIncomingMessage(vendor.id, "+19998887777", "Test User", "test duplicate please", Date.now(), msgId);
  // Simulate stall re-delivery 1 second later
  setTimeout(() => {
    console.log("Simulating stall re-delivery...");
    queueIncomingMessage(vendor.id, "+19998887777", "Test User", "test duplicate please", Date.now(), msgId).catch(console.error);
  }, 1000);

  console.log("Waiting 30 seconds for processing, stalls, and retries...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  const outboundCount = await outboundQueue.count();
  const completed = await outboundQueue.getCompletedCount();
  console.log(`Outbound jobs created (waiting+completed): ${outboundCount + completed}`);

  process.exit(0);
}

run().catch(console.error);
