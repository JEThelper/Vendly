import { db, vendorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ConversationManager } from "./src/lib/intelligence/conversation-manager";

async function runTests() {
  const [vendor] = await db.select().from(vendorsTable).limit(1);
  if (!vendor) {
    console.log("No vendor found");
    process.exit(1);
  }

  const adminPhone = vendor.adminNumber || "+15555555555";
  const customerPhone = "+19999999999";

  const testCases = [
    // 1. Part 3 Admin side
    { name: "Admin Confirm Order", phone: adminPhone, body: "confirm" },
    { name: "Admin Reject Order", phone: adminPhone, body: "reject" },
    { name: "Admin Confirm Payment", phone: adminPhone, body: "paid confirmed" },
    { name: "Admin ETA", phone: adminPhone, body: "eta 12345 15 mins" },
    { name: "Admin Reset", phone: adminPhone, body: "/reset" },
    { name: "Admin Help", phone: adminPhone, body: "/admin" },
    { name: "Admin Bot Off", phone: adminPhone, body: "/bot off" },
    { name: "Admin Promo List", phone: adminPhone, body: "/promo list" },
    
    // 2. Part 4 Customer Side
    { name: "Customer Greeting", phone: customerPhone, body: "hello there" },
    { name: "Customer Confirm", phone: customerPhone, body: "yep" },
    { name: "Customer Cancel", phone: customerPhone, body: "cancel" },
    { name: "Customer Payment Claim", phone: customerPhone, body: "i don pay" },
    { name: "Customer Order Tracking", phone: customerPhone, body: "wetin dey happen to my order" },
    { name: "Customer Help", phone: customerPhone, body: "i need help" },
    { name: "Customer Restart", phone: customerPhone, body: "start over" },
    
    // 3. Part 5 Exclusion Cases (MUST go to LLM)
    { name: "Exclusion - Extra words", phone: customerPhone, body: "yes but change the quantity" },
    { name: "Exclusion - Extra words 2", phone: customerPhone, body: "no I meant 2 plates" },

    // 4. Button exact matches
    { name: "Button Cancel", phone: customerPhone, body: "cancel" },
  ];

  for (const tc of testCases) {
    console.log(`\n--- Test: ${tc.name} ---`);
    console.log(`Payload: ${tc.body} from ${tc.phone}`);
    const res = await ConversationManager.handleIncomingMessage(vendor, tc.phone, tc.body, "Test Customer");
    console.log(`Response text: ${res.text}`);
    if (res.buttons) console.log(`Buttons: ${JSON.stringify(res.buttons)}`);
    if (res.list) console.log(`List: ${JSON.stringify(res.list)}`);
  }
}

runTests().catch(console.error).finally(() => process.exit(0));
