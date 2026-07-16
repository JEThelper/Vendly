import { checkQueueHealth } from "./lib/queue";

async function main() {
  const health = await checkQueueHealth();
  console.log("Queue Health:", health);
  process.exit(0);
}

main().catch(console.error);
