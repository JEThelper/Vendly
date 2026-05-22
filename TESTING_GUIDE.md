# 🧪 Testing Guide - Before Production Deployment

This guide will help you test all 7 production fixes before deploying to production.

---

## 📋 Pre-Flight Checklist

### 1. Environment Setup

Create `.env` file in `artifacts/api-server/`:

```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/vendor_connect_hub
DB_POOL_SIZE=20
DB_POOL_MIN=5

# Redis (for job queues)
REDIS_URL=redis://localhost:6379

# WhatsApp Integration
ACCESS_TOKEN=your_meta_access_token_here
VERIFY_TOKEN=your_webhook_verify_token_here

# Server
PORT=3000
NODE_ENV=development
```

### 2. Dependencies

```bash
# Check Docker is running
docker --version

# Start PostgreSQL (if using Docker)
docker run -d --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=vendor_connect_hub \
  -p 5432:5432 \
  postgres:15

# Start Redis (if using Docker)
docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 3. Run Pre-Flight Checks

```bash
cd /workspaces/Automation-Bot/Vendor-Connect-Hub
bash scripts/pre-flight-check.sh
```

Expected output:
```
✅ .env file exists
✅ redis-cli available
✅ psql available
✅ TypeScript check passed
✅ Build succeeded
```

---

## 🚀 Starting the Server

### Terminal 1: Start the API Server

```bash
cd artifacts/api-server

# Install dependencies (if not already done)
pnpm install

# Build
pnpm run build

# Start server
PORT=3000 node dist/index.mjs
```

Expected startup logs:
```
Server listening on port 3000
Database health check passed
Queue workers initialized
Periodic cleanup tasks scheduled
✅ All production systems initialized
```

### Check Server Health

```bash
curl http://localhost:3000/api/health 2>/dev/null | jq .
```

You should see a 200 response (implement `/api/health` endpoint if not already there).

---

## ✅ Test Each Bug Fix

### Bug #1: AI Timeout (5-second limit)

```bash
# Set a fake Gemini key to trigger fallback
export GEMINI_API_KEY="invalid-key-for-testing"

# Send a message that would trigger AI
curl -X POST http://localhost:3000/api/webhook/messages \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "metadata": {"phone_number_id": "1234567890", "display_phone_number": "2348011111111"},
          "contacts": [{"profile": {"name": "Test"}, "wa_id": "2348011111111"}],
          "messages": [{
            "from": "2348011111111",
            "type": "text",
            "text": {"body": "Can you extract: 2 pizzas and 1 drink"}
          }]
        }
      }]
    }]
  }'

# Expected: Bot responds within 100ms (timeout at 5s)
# Check logs for: "AI extraction timeout, using rule-based fallback"
```

✅ **Passes if**: Response is fast even with slow AI

---

### Bug #2: Database Connection Pooling

```bash
# Check pool stats
psql -h localhost -U user -d vendor_connect_hub -c "
  SELECT datname, count(*) FROM pg_stat_activity 
  WHERE datname IS NOT NULL GROUP BY datname;
"

# Should show:
# - Max 20 connections at peak
# - Idle connections auto-close after 30s
```

✅ **Passes if**: No "connection rejected" errors under load

---

### Bug #3: Pending Orders Survive Restart

```bash
# 1. Send an order (don't confirm yet)
bash scripts/test-incoming-messages.sh | head -1

# 2. Check pending orders in DB
psql -h localhost -U user -d vendor_connect_hub -c \
  "SELECT * FROM pending_orders LIMIT 1;"

# 3. Kill the server (Ctrl+C)

# 4. Start it again
node dist/index.mjs

# 5. Confirm the order still exists
psql -h localhost -U user -d vendor_connect_hub -c \
  "SELECT * FROM pending_orders WHERE expires_at > NOW();"
```

✅ **Passes if**: Pending orders exist after restart

---

### Bug #4: Idempotency Keys (No Duplicates)

```bash
# Send the same order twice quickly
for i in {1..2}; do
  curl -X POST http://localhost:3000/api/webhook/messages \
    -H "Content-Type: application/json" \
    -d '{...same message...}' &
done

wait

# Check orders in DB
psql -h localhost -U user -d vendor_connect_hub -c \
  "SELECT customer_phone, COUNT(*) as count 
   FROM orders 
   GROUP BY customer_phone 
   HAVING count > 1;"
```

✅ **Passes if**: No duplicate orders created

---

### Bug #5: Message Delivery Retry

```bash
# Check outbound queue
redis-cli LLEN "bull:outbound-messages:wait"
redis-cli LLEN "bull:outbound-messages:active"

# Simulate WhatsApp API failure by:
# 1. Stopping WhatsApp API access temporarily
# 2. Sending a message
# 3. Verify queue job retries (up to 5 times)
# 4. Restore access
# 5. Message should deliver automatically

# Check failed messages
redis-cli LRANGE "bull:outbound-messages:failed" 0 -1
```

✅ **Passes if**: Failed messages are retried automatically

---

### Bug #6: Circuit Breaker for Gemini

```bash
# Stop Gemini API access (or use invalid key)
export GEMINI_API_KEY="invalid"

# Send 20 orders rapidly
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/webhook/messages \
    -H "Content-Type: application/json" \
    -d '{...message...}' &
done

# Expected behavior:
# - First 5-10 requests timeout (trying AI)
# - Circuit opens after 50% failures
# - Remaining requests fail fast (0ms) and use rule-based
# - Check logs for: "Circuit breaker OPENED"

# After 30 seconds:
# - Circuit tries again (HALF-OPEN)
# - If AI still down, opens again
# - If AI recovers, closes
```

✅ **Passes if**: Circuit breaker logs show state changes

---

### Bug #7: Request Backpressure

```bash
# Terminal 1: Watch queue
watch -n 1 'redis-cli LLEN "bull:incoming-messages:wait"'

# Terminal 2: Send 1000 concurrent messages
bash scripts/load-test.sh 1000 50

# Expected behavior:
# - Queue fills up (1000+ jobs)
# - Memory stays stable (< 500MB)
# - Server stays responsive
# - No crashes
# - Jobs processed gradually (5 at a time)
# - After 5 minutes, queue empties

# Terminal 3: Monitor memory
while true; do
  free -h | grep Mem
  sleep 2
done
```

✅ **Passes if**: 
- Memory stable despite 1000 messages
- No crashes
- Queue processes smoothly

---

## 📊 Load Testing (Advanced)

### Using k6 (Recommended)

Install k6:
```bash
# macOS
brew install grafana/k6/k6

# Linux
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

Create `load-test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp-up to 100 users
    { duration: '1m30s', target: 100 }, // Stay at 100
    { duration: '20s', target: 0 },     // Ramp-down
  ],
};

export default function () {
  const url = 'http://localhost:3000/api/webhook/messages';
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          metadata: {
            phone_number_id: '1234567890',
            display_phone_number: '2348011111111'
          },
          contacts: [{ 
            profile: { name: `User${__VU}` }, 
            wa_id: `234801111111${__VU}` 
          }],
          messages: [{
            from: `234801111111${__VU}`,
            type: 'text',
            text: { body: `Hello from VU ${__VU}` }
          }]
        }
      }]
    }]
  });

  const res = http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'is status 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Run:
```bash
k6 run load-test.js
```

---

## 🔍 Monitoring During Tests

### Terminal 1: Server Logs
```bash
cd artifacts/api-server
node dist/index.mjs
```

Look for:
- ✅ Messages received and queued
- ✅ Queue processing started
- ✅ No errors or timeouts
- ✅ Circuit breaker state changes

### Terminal 2: Redis Queue Monitoring
```bash
watch -n 1 'redis-cli --raw LLEN "bull:incoming-messages:wait"'
watch -n 1 'redis-cli --raw LLEN "bull:outbound-messages:wait"'
```

### Terminal 3: Database Monitoring
```bash
watch -n 2 'psql -h localhost -U user -d vendor_connect_hub -c \
  "SELECT 
    (SELECT COUNT(*) FROM orders) as total_orders,
    (SELECT COUNT(*) FROM pending_orders) as pending,
    (SELECT COUNT(*) FROM idempotency_keys) as idempotency_keys;
"'
```

### Terminal 4: Memory/CPU
```bash
top -p $(pgrep -f 'node dist/index.mjs' | head -1)
```

---

## 🧩 Verification Checklist

After running all tests, verify:

- [ ] **Bug #1**: AI timeout works (5-second max)
- [ ] **Bug #2**: Database pool works (20 max connections)
- [ ] **Bug #3**: Pending orders survive restart
- [ ] **Bug #4**: No duplicate orders from retries
- [ ] **Bug #5**: Messages retry on failure
- [ ] **Bug #6**: Circuit breaker opens on AI failure
- [ ] **Bug #7**: Handle 1000+ concurrent messages
- [ ] No crashes under load
- [ ] Memory stays stable
- [ ] All logs are clean (no errors)
- [ ] Queue processes complete
- [ ] Response time < 200ms typical

---

## ❌ Troubleshooting

### Server won't start
```bash
# Check ports in use
lsof -i :3000  # Node.js
lsof -i :5432 # PostgreSQL
lsof -i :6379 # Redis

# Kill and restart
kill -9 <PID>
```

### Queue not processing
```bash
# Check Redis
redis-cli PING
redis-cli DBSIZE

# Check queue status
redis-cli LLEN "bull:incoming-messages:wait"
redis-cli HLEN "bull:incoming-messages:active"

# View failed jobs
redis-cli HGETALL "bull:incoming-messages:failed"
```

### Database errors
```bash
# Check connection
psql -h localhost -U user -d vendor_connect_hub -c "SELECT 1"

# Check tables exist
psql -h localhost -U user -d vendor_connect_hub -dt

# Restart Docker container
docker restart postgres
```

---

## 🎯 Production Readiness Criteria

Before deploying, ensure:

```
✅ All 7 bugs verified working
✅ Load test passed (100+ concurrent users)
✅ Memory stable under load
✅ No errors in logs
✅ All queues processing
✅ Response times < 200ms
✅ Message delivery > 99%
✅ Circuit breaker tested
✅ Database pooling working
✅ Graceful shutdown works (Ctrl+C)
```

---

## 🚀 Ready to Deploy!

Once all tests pass, you're ready to deploy to production.

**See PRODUCTION_FIXES_COMPLETE.md for deployment instructions.**
