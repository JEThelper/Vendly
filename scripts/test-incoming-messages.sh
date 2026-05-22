#!/bin/bash

# Test script for incoming messages
# This simulates WhatsApp messages coming from Meta webhook

BASE_URL="http://localhost:3000"
PHONE_NUMBER_ID="1234567890"  # Your WhatsApp Business phone number ID
TO_PHONE="+234801234567"       # Customer phone
FROM_PHONE="2348011111111"     # Bot's phone

echo "🧪 Testing Incoming Messages"
echo "=============================="
echo ""

# Test 1: Greeting
echo "Test 1: Greeting message"
curl -X POST "$BASE_URL/api/webhook/messages" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": {
          "phone_number_id": "1234567890",
          "display_phone_number": "2348011111111"
        },
        "contacts": [{"profile": {"name": "John"}, "wa_id": "2348011111111"}],
        "messages": [{
          "from": "2348011111111",
          "type": "text",
          "text": {"body": "hello"}
        }]
      }
    }]
  }]
}
EOF
echo ""
echo ""

# Test 2: Menu request
echo "Test 2: Menu request"
curl -X POST "$BASE_URL/api/webhook/messages" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": {
          "phone_number_id": "1234567890",
          "display_phone_number": "2348011111111"
        },
        "contacts": [{"profile": {"name": "John"}, "wa_id": "2348011111111"}],
        "messages": [{
          "from": "2348011111111",
          "type": "text",
          "text": {"body": "menu"}
        }]
      }
    }]
  }]
}
EOF
echo ""
echo ""

# Test 3: Order with number
echo "Test 3: Order (item #1)"
curl -X POST "$BASE_URL/api/webhook/messages" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": {
          "phone_number_id": "1234567890",
          "display_phone_number": "2348011111111"
        },
        "contacts": [{"profile": {"name": "John"}, "wa_id": "2348011111111"}],
        "messages": [{
          "from": "2348011111111",
          "type": "text",
          "text": {"body": "I want item 1"}
        }]
      }
    }]
  }]
}
EOF
echo ""
echo ""

# Test 4: Confirmation
echo "Test 4: Order confirmation (YES)"
curl -X POST "$BASE_URL/api/webhook/messages" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": {
          "phone_number_id": "1234567890",
          "display_phone_number": "2348011111111"
        },
        "contacts": [{"profile": {"name": "John"}, "wa_id": "2348011111111"}],
        "messages": [{
          "from": "2348011111111",
          "type": "text",
          "text": {"body": "YES"}
        }]
      }
    }]
  }]
}
EOF
echo ""
echo ""

echo "✅ All test messages sent!"
echo ""
echo "Check server logs to see:"
echo "- Message received and queued"
echo "- Bot reply generated"
echo "- Queue processing status"
