#!/bin/bash

# Simple load test - sends concurrent webhook requests

BASE_URL="http://localhost:3000"
NUM_REQUESTS=${1:-100}  # Default 100 requests, or pass as argument
CONCURRENT=${2:-10}     # Default 10 concurrent, or pass as argument

echo "📊 Load Testing WhatsApp Bot"
echo "=============================="
echo "Sending $NUM_REQUESTS requests with $CONCURRENT concurrent connections"
echo ""

# Function to send a single request
send_request() {
  local req_num=$1
  
  curl -s -X POST "$BASE_URL/api/webhook/messages" \
    -H "Content-Type: application/json" \
    -d "{
      \"object\": \"whatsapp_business_account\",
      \"entry\": [{
        \"changes\": [{
          \"value\": {
            \"metadata\": {
              \"phone_number_id\": \"1234567890\",
              \"display_phone_number\": \"2348011111111\"
            },
            \"contacts\": [{\"profile\": {\"name\": \"Customer$req_num\"}, \"wa_id\": \"234801111111$((req_num % 100))\"}],
            \"messages\": [{
              \"from\": \"234801111111$((req_num % 100))\",
              \"type\": \"text\",
              \"text\": {\"body\": \"hello from test $req_num\"}
            }]
          }
        }]
      }]
    }" > /dev/null 2>&1
  
  echo "✓ Request $req_num sent"
}

# Send requests
start_time=$(date +%s)

for ((i=1; i<=NUM_REQUESTS; i++)); do
  send_request $i &
  
  # Limit concurrency
  if (( i % CONCURRENT == 0 )); then
    wait
  fi
done

wait

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "✅ Load test completed!"
echo "  Total requests: $NUM_REQUESTS"
echo "  Duration: ${duration}s"
echo "  Rate: $(echo "scale=2; $NUM_REQUESTS / $duration" | bc) req/sec"
echo ""
echo "Next steps:"
echo "1. Check queue status: redis-cli LLEN 'bull:incoming-messages:wait'"
echo "2. Monitor server logs for errors"
echo "3. Check memory usage didn't spike"
echo "4. Verify all messages were queued"
