# 🚀 Production Deployment Guide

## Overview

This guide covers the complete production deployment of the Vendor-Connect-Hub bot system. The system is designed for **zero-downtime operation** with automatic failover, graceful degradation, and built-in resilience.

---

## Architecture Changes (Production vs Development)

### Before (Development)
- ❌ In-memory pending orders (lost on restart)
- ❌ No message queue (synchronous processing)
- ❌ No timeout protection (AI calls could hang forever)
- ❌ No circuit breaker (single point of failure)
- ❌ No connection pooling (database exhaustion under load)
- ❌ No idempotency protection (duplicate orders possible)
- ❌ No rate limiting (spam could crash system)

### After (Production)
- ✅ Database-backed pending orders (survives restarts)
- ✅ Bull queue for message processing (backpressure protection)
- ✅ 5-second AI timeout (never hangs)
- ✅ Circuit breaker for external services (fail fast)
- ✅ Configured connection pool (handles load spikes)
- ✅ Idempotency keys (prevents duplicates)
- ✅ Per-customer rate limiting (spam protection)
- ✅ Redis-backed infrastructure (distributed, scalable)
- ✅ Graceful shutdown (zero data loss)
- ✅ Comprehensive health checks (monitoring ready)

---

## System Requirements

### Minimum

- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher
- **Redis**: 6.x or higher
- **Memory**: 512MB RAM
- **Disk**: 50GB for database logs/backups

### Production (Recommended)

- **Node.js**: 20.x LTS (or higher)
- **PostgreSQL**: 15.x or higher (with automated backups)
- **Redis**: 7.x (cluster mode if >10k msgs/day)
- **Memory**: 2GB+ RAM
- **Disk**: 500GB+ SSD (for high throughput)
- **CPU**: 2+ cores (for concurrency)

---

## Environment Variables

### Critical (Required)

```bash
# Server
PORT=3000                           # API port
NODE_ENV=production                # Set to "production"

# Database
DATABASE_URL=postgresql://user:pass@host:5432/vendor_bot
DB_POOL_SIZE=20                    # Max connections
DB_POOL_MIN=5                      # Min idle connections

# Redis (Message Queue)
REDIS_URL=redis://user:pass@host:6379/0

# WhatsApp
ACCESS_TOKEN=<Meta WhatsApp API token>
VERIFY_TOKEN=<Custom webhook verification token>

# AI (Optional - bot degrades gracefully if missing)
OPENAI_API_KEY=<OpenAI API key>      # For free-form text orders
```

### Optional (Recommended for Production)

```bash
# Monitoring
SENTRY_DSN=https://...              # Error tracking
DATADOG_API_KEY=<key>               # Application monitoring

# Feature Flags
ENABLE_BROADCASTS=true              # Allow vendor broadcasts
ENABLE_FOLLOW_UPS=true              # Allow auto follow-ups
ENABLE_AI_EXTRACTION=true           # Use AI for order extraction

# Logging
LOG_LEVEL=info                      # info, warn, error
LOG_FORMAT=json                     # structured logging
```

---

## Database Setup

### 1. Create Database

```bash
createdb vendor_bot

# Or via Docker
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secretpass \
  -e POSTGRES_DB=vendor_bot \
  -p 5432:5432 \
  postgres:15
```

### 2. Run Migrations

```bash
cd /workspaces/Automation-Bot/Vendor-Connect-Hub

# Install dependencies
pnpm install

# Build database package
pnpm run build

# Drizzle ORM will auto-create tables (lazy initialization)
```

### 3. Create Indexes for Performance

```sql
-- Already created by schema, but verify these exist:
CREATE INDEX IF NOT EXISTS pending_orders_vendor_customer_idx 
  ON pending_orders(vendor_id, customer_phone) UNIQUE;

CREATE INDEX IF NOT EXISTS pending_orders_expires_at_idx 
  ON pending_orders(expires_at);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx 
  ON idempotency_keys(expires_at);

CREATE INDEX IF NOT EXISTS orders_vendor_id_idx 
  ON orders(vendor_id);

CREATE INDEX IF NOT EXISTS orders_customer_phone_idx 
  ON orders(customer_phone);

CREATE INDEX IF NOT EXISTS conversations_vendor_customer_idx 
  ON conversations(vendor_id, customer_phone) UNIQUE;

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx 
  ON messages(conversation_id);
```

### 4. Set Up Connection Pool

The connection pool is configured in `lib/db/src/index.ts`:

```typescript
{
  max: 20,                          // Max connections
  min: 5,                           // Min idle connections
  idleTimeoutMillis: 30000,         // Close idle after 30s
  connectionTimeoutMillis: 5000,    // Timeout for acquiring
}
```

**Tuning for your load:**
- Light load (< 100 msg/day): `max: 10`
- Medium load (100-1000 msg/day): `max: 20` ✅ (default)
- High load (1000-10k msg/day): `max: 30-50`
- Very high load (10k+ msg/day): Use read replicas + connection pooler (PgBouncer)

---

## Redis Setup

### 1. Install Redis

```bash
# macOS
brew install redis

# Ubuntu
sudo apt install redis-server

# Or via Docker
docker run -d \
  --name redis \
  -e REDIS_PASSWORD=secretpass \
  -p 6379:6379 \
  redis:7 redis-server --requirepass secretpass
```

### 2. Verify Connection

```bash
redis-cli ping
# Should return: PONG

# With password:
redis-cli -a secretpass ping
```

### 3. Redis Persistence (Important!)

Ensure Redis is configured for persistence (prevents job loss):

```ini
# /etc/redis/redis.conf or docker environment
appendonly yes                      # Enable AOF persistence
appendfsync everysec                # Sync every second
```

---

## Application Startup

### Local Development

```bash
cd /workspaces/Automation-Bot/Vendor-Connect-Hub/artifacts/api-server

# Install dependencies
pnpm install

# Development server
pnpm run dev

# Or production build
pnpm run build
node --enable-source-maps dist/index.mjs
```

### Docker Production

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib ./lib

# Install dependencies (production only)
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# Build
RUN cd artifacts/api-server && pnpm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/healthz')" || exit 1

# Start
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
```

### Docker Compose (Local/Staging)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: vendor_bot
      POSTGRES_PASSWORD: devpass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      PORT: 3000
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:devpass@postgres:5432/vendor_bot
      REDIS_URL: redis://redis:6379/0
      VERIFY_TOKEN: webhook_token_123
      ACCESS_TOKEN: ${WHATSAPP_ACCESS_TOKEN}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: Queue monitoring dashboard
  bull-board:
    image: bull-board
    environment:
      REDIS_URL: redis://redis:6379/0
    ports:
      - "3001:3001"
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All code is tested and reviewed
- [ ] `.env.production` file is created with all required variables
- [ ] Database backups configured
- [ ] SSL certificates installed (for WhatsApp webhook)
- [ ] PostgreSQL backup strategy implemented
- [ ] Redis persistence enabled
- [ ] Load testing completed (see "Testing" section)

### During Deployment

- [ ] Database migrations run successfully
- [ ] API server starts without errors
- [ ] Queue workers are processing jobs
- [ ] Health checks pass (`/api/health/deep`)
- [ ] WhatsApp webhook is configured and verified
- [ ] First test message processes successfully

### Post-Deployment

- [ ] Monitor logs for errors
- [ ] Verify queue depth is stable
- [ ] Check database connection pool usage
- [ ] Monitor memory consumption
- [ ] Test all critical flows:
  - Normal order flow
  - Order confirmation
  - Multi-item orders
  - Rate limiting
  - Broadcast sending

---

## Testing Before Going Live

### 1. Unit Tests

```bash
pnpm run test

# Run specific test file
pnpm run test -- pending-orders.test.ts
```

### 2. Load Testing

Simulate production load to ensure everything works:

```bash
# Using k6 (modern load testing)
k6 run load-test.js

# Script: load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 10 },      // Ramp up
    { duration: '1m30s', target: 100 },   // Stay at 100
    { duration: '20s', target: 0 },       // Ramp down
  ],
};

export default function () {
  let payload = {
    to: '1234567890',
    body: 'Order 1x2',
  };

  let res = http.post('http://localhost:3000/api/webhook/whatsapp', payload);
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

### 3. Chaos Testing

Test resilience to failures:

```bash
# Stop Redis and verify bot still works (ruled-based fallback)
redis-cli shutdown

# Verify error logs show graceful degradation
# Re-enable Redis
redis-server

# Stop database and verify circuit breaker engages
sudo systemctl stop postgresql

# Verify queue retries and recovers
sudo systemctl start postgresql
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

```
1. Queue Health
   - pending_incoming_messages (should be <10)
   - pending_outbound_messages (should be <20)
   - failed_jobs_total (watch for spikes)

2. Database
   - active_connections (should be <15 normally)
   - connection_timeouts (should be 0)
   - query_duration_p95 (should be <50ms)

3. Application
   - httpRequests_duration_p95 (should be <200ms)
   - errors_total (should be low)
   - uptime (should be 99.9%+)

4. External Services
   - openai_api_latency_p95 (should be <2000ms)
   - whatsapp_api_latency_p95 (should be <1000ms)
```

### Sample Monitoring Setup (Datadog)

```javascript
// In index.ts
import StatsD from 'dogstatsd/node_modules/dogstatsd';

const dogstatsd = new StatsD();

// Track queue health
setInterval(async () => {
  const { pendingIncoming, pendingOutbound } = await checkQueueHealth();
  dogstatsd.gauge('queue.pending.incoming', pendingIncoming);
  dogstatsd.gauge('queue.pending.outbound', pendingOutbound);
}, 60000);

// Track errors
process.on('uncaughtException', (err) => {
  dogstatsd.increment('errors.uncaught', 1);
});
```

---

## Scaling Beyond Single Instance

### For 10,000+ Messages/Day

Use multiple API instances behind a load balancer:

```
                          ┌─────────────┐
                          │  Load       │
                          │  Balancer   │
                          │  (nginx)    │
                          └─────┬───────┘
                      ┌─────────┼─────────┐
                      │         │         │
                    ┌─┴──┐   ┌─┴──┐   ┌─┴──┐
                    │API │   │API │   │API │
                    │ #1 │   │ #2 │   │ #3 │
                    └─┬──┘   └─┬──┘   └─┬──┘
                      │         │         │
                      └─────────┼─────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
               ┌────┴────┐           ┌─────┴────┐
               │ Database│           │  Redis   │
               │ (Primary)           │ (Cluster)│
               └────┬────┘           └──────────┘
                    │
               ┌────┴────┐
               │ Database│
               │ (Replica)
               └─────────┘
```

**Configuration:**

```nginx
# nginx.conf
upstream api {
    server api1:3000;
    server api2:3000;
    server api3:3000;
}

server {
    listen 80;
    location /api {
        proxy_pass http://api;
        proxy_read_timeout 30s;
    }
}
```

**Database Read Replicas:**

```bash
# PostgreSQL replication
primary_conninfo = 'host=primary_db user=replication password=pass'
```

---

## Emergency Procedures

### Connection Pool Exhaustion

**Symptom:** Lots of "connection timeout" errors

**Recovery:**
```bash
# Restart API servers one at a time (behind load balancer)
docker restart api-1
sleep 30
docker restart api-2
# etc.

# Or increase pool size:
export DB_POOL_SIZE=40
docker restart api-server
```

### Queue Backlog Building Up

**Symptom:** `pending_incoming_messages` > 100

**Recovery:**
```bash
# Check if Redis is slow
redis-cli --latency

# Scale up workers
export INCOMING_CONCURRENCY=10
docker restart api-server

# Or increase machine resources if CPU-bound
```

### Out of Memory

**Symptom:** Process crashes with OOM

**Recovery:**
```bash
# Check memory usage
docker stats

# Reduce pool sizes
export DB_POOL_SIZE=10
export NODE_OPTIONS="--max-old-space-size=1024"  # 1GB

# Restart
docker restart api-server

# If still OOM, scale horizontally (more instances)
```

### Database Corruption

**Symptom:** Query errors, unexpected data

**Recovery:**
```bash
# Restore from backup
pg_restore -d vendor_bot backup_file.sql

# Or from AWS RDS backup
# Via AWS console: Snapshots → Restore
```

---

## Rollback Procedure

If deployment breaks production:

```bash
# 1. Switch traffic back to previous version (if using load balancer)
docker service update --image myregistry/api:v1.0.0 api-service

# 2. Or restart with previous Docker image
docker run -d \
  --name api-prod \
  --env-file .env.production \
  myregistry/api:v1.0.0

# 3. Verify health
curl http://api-server:3000/api/health/deep

# 4. Check error logs
docker logs api-prod | grep ERROR
```

---

## Performance Optimization

### Database Query Optimization

```sql
-- Add missing indexes
CREATE INDEX orders_created_at ON orders(created_at DESC);
CREATE INDEX orders_status ON orders(status);
CREATE INDEX conversations_last_message_at ON conversations(last_message_at DESC);

-- Analyze query plans
EXPLAIN ANALYZE
SELECT * FROM orders 
WHERE vendor_id = '...' AND created_at > NOW() - INTERVAL '24 hours';
```

### Connection Pool Tuning

```
┌─ Measure current usage ─┐
│ SELECT count(*) FROM   │
│ pg_stat_activity;      │
└────────────────────────┘
     │
     ├─ < 5 active: Reduce pool size to save memory
     ├─ 10-15 active: Pool size is good (20 is optimal)
     └─ > 20 active: Increase pool and/or add database replicas
```

### Redis Optimization

```bash
# Monitor Redis memory
redis-cli INFO memory

# Monitor keys
redis-cli --scan --pattern "*"

# Cleanup old keys
# Old idempotency keys are auto-deleted (24-hour TTL)
# Old pending orders are auto-deleted (15-minute TTL)
```

---

## Support & Emergency Contacts

- **On-Call Engineer**: [team contact]
- **AWS Support**: [support link]
- **Database DBA**: [team contact]
- **Incident Slack Channel**: #bot-incidents

---

## Summary

✅ Production system is **robust, scalable, and resilient**
✅ Zero-downtime deployments possible with proper procedures
✅ Graceful degradation when external services fail
✅ Automatic recovery from transient failures
✅ Comprehensive monitoring and alerting

**Launch confidence: HIGH** ✨

