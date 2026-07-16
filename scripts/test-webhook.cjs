const crypto = require("crypto");

const APP_SECRET = "dummy_app_secret";
const TARGET_URL = "http://localhost:3000/api/webhook/messages";

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "12345",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "1234567890",
              phone_number_id: "phone_id_demo_1",
            },
            contacts: [
              {
                profile: {
                  name: "Test Customer",
                },
                wa_id: "9876543210",
              },
            ],
            messages: [
              {
                from: "9876543210",
                id: `wamid.HBgL${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: "Hi, I want a pepperoni pizza",
                },
                type: "text",
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

const payloadString = JSON.stringify(payload);
const signature = crypto
  .createHmac("sha256", APP_SECRET)
  .update(payloadString)
  .digest("hex");

fetch(TARGET_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-hub-signature-256": `sha256=${signature}`,
  },
  body: payloadString,
})
  .then((res) => res.text().then((text) => ({ status: res.status, text })))
  .then(console.log)
  .catch(console.error);
