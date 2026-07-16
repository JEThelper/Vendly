import { withVendorContext } from "@workspace/db";
import { ConversationManager } from "./src/lib/intelligence/conversation-manager";

async function main() {
  const vendorId = process.env.VENDOR_ID || "8956ddb6-2e0a-4d3b-a3ff-6f3a142cb32f";
  
  await withVendorContext(vendorId, async () => {
    try {
      console.log("Running ConversationManager inside context...");
      const mockVendor = { id: vendorId } as any;

      const result = await ConversationManager.handleIncomingMessage(
        mockVendor,
        "+15550000111",
        "test message from simulator 3"
      );
      
      console.log("Result:", result);
    } catch (e) {
      console.error(e);
    }
  });

  process.exit(0);
}

main().catch(console.error);
