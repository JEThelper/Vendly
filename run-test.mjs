import crypto from 'crypto';

const appSecret = process.env.WHATSAPP_APP_SECRET;
if (!appSecret) throw new Error("No WHATSAPP_APP_SECRET");

const phoneNumberId = "phone_id_demo_1";

async function sendTestMessage(text, id) {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      id: "test",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "15550000000",
            phone_number_id: phoneNumberId
          },
          contacts: [{
            profile: { name: "Test User" },
            wa_id: "15550000111"
          }],
          messages: [{
            from: "15550000111",
            id: `wamid.test_${id}_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: "text",
            text: { body: text }
          }]
        },
        field: "messages"
      }]
    }]
  };

  const rawBody = JSON.stringify(payload);
  const signature = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const res = await fetch("http://localhost:3000/api/webhook/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signature
    },
    body: rawBody
  });

  console.log(`Sent "${text}":`, res.status);
  // Wait a bit to let it process
  await new Promise(r => setTimeout(r, 4000));
}

async function run() {
  await sendTestMessage("Hi", 1);
  await sendTestMessage("What is on the menu?", 2);
  await sendTestMessage("I want 1 jollof rice", 3);
  await sendTestMessage("Make it two portions and add zobo", 4);
  await sendTestMessage("That's it, confirm order", 5);
}

run().catch(console.error);
