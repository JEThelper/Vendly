# 🚀 Production Deployment Guide

**Status**: Production Ready ✅  
**Version**: 2.0  
**Last Updated**: May 22, 2026  
**Audit Date**: May 22, 2026 (Production Readiness Audit Completed)

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring & Operations](#monitoring--operations)
7. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying to production, verify all items:

### Infrastructure
- [ ] PostgreSQL database provisioned (min 2GB RAM, backups configured)
- [ ] Redis instance running (min 1GB RAM, persistence enabled)
- [ ] Node.js 18+ installed and verified
- [ ] SSL certificates obtained (for HTTPS) - auto-managed by Vercel
- [ ] Domain/DNS configured or use Vercel.com domain
- [ ] Firewall rules configured (if using custom server)

### External Services
- [ ] PostgreSQL database created and connection string obtained
- [ ] Redis instance created and connection URL obtained
- [ ] Meta WhatsApp Business Account activated
- [ ] WhatsApp Cloud API access token obtained
- [ ] Google Gemini API key provisioned (optional, for AI extraction)
- [ ] Payment gateway configured (if processing payments)

### Code & Build
- [x] Git repository cloned
- [x] All environment variables documented in `.env.example`
- [x] Build tested locally (`pnpm build` succeeds)
- [x] Type checking passes (`pnpm run typecheck`) ✅ PASSES
- [x] No TypeScript errors or warnings ✅ STRICT MODE ENABLED
- [x] No console.log statements in production code ✅ VERIFIED
- [x] Webhook signature validation implemented ✅ X-Hub-Signature-256
- [x] Environment variables validated at startup ✅ REQUIRED VARS CHECKED

### Operations
- [ ] Logging configured (Pino transports set up)
- [ ] Error tracking configured (Sentry or equivalent)
- [ ] Monitoring/alerting setup (CPU, memory, database)
- [ ] Database backup schedule configured
- [ ] Redis snapshot backups configured
- [ ] Incident response plan documented

---

## Environment Setup

### Step 1: Create .env File

Create `.env` file in root and each service directory:

#### `/Vendor-Connect-Hub/.env`
```bash
# Node Environment
NODE_ENV=production

# API Server
PORT=3000
HOST=0.0.0.0

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
DB_POOL_SIZE=20
DB_POOL_MIN=5
DB_POOL_TIMEOUT=5000

# Redis (Optional - if not using Supabase Redis)
REDIS_URL=redis://:password@redis-host:6379/0

# WhatsApp Integration
WHATSAPP_TOKEN=<your-meta-cloud-api-token>
WHATSAPP_PHONE_ID=<your-phone-number-id>
WHATSAPP_BUSINESS_ACCOUNT_ID=<your-business-account-id>
WHATSAPP_VERIFY_TOKEN=<generate-random-string>
WHATSAPP_WEBHOOK_URL=https://yourdomain.com/api/webhook

# Google Gemini AI Integration
GEMINI_API_KEY=<your-google-gemini-api-key>
GEMINI_MODEL=gemini-1.5-flash

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=1000
CORS_ORIGIN=https://yourdomain.com

# Optional: Error Tracking
SENTRY_DSN=<your-sentry-dsn>
SENTRY_ENVIRONMENT=production
```

#### `/artifacts/api-server/.env`
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://[user]:[password]@[supabase-host]/[database]
REDIS_URL=redis://...
WHATSAPP_TOKEN=...
GEMINI_API_KEY=...
```

#### `/artifacts/control-panel/.env`
```bash
PORT=5173
BASE_PATH=/
API_BASE_URL=https://yourdomain.com
VITE_API_URL=https://yourdomain.com
```

### Step 3: Verify Connections

```bash
# Test Supabase PostgreSQL
psql $DATABASE_URL -c "SELECT 1"
# Expected: (1 row)

# Test Redis (if configured)
redis-cli -u $REDIS_URL ping
# Expected: PONG

# Test Gemini API
curl -s "https://generativelanguage.googleapis.com/v1/models?key=$GEMINI_API_KEY" | head -20
# Expected: JSON response with models list
```

---

## Database Setup with Supabase

### Step 1: Supabase Already Has PostgreSQL!

Supabase provides a ready-to-use PostgreSQL database. No setup needed!

- ✅ Database already created
- ✅ Connection string provided in dashboard
- ✅ Automatic backups enabled
- ✅ Row-level security available

### Step 2: Run Migrations

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Run Drizzle migrations
cd lib/db
DATABASE_URL=$DATABASE_URL pnpm run migrate
# This creates all tables with proper schemas in your Supabase database
```

### Step 3: Verify Schema in Supabase

You can verify the schema two ways:

**Option 1: Supabase Dashboard**
- Go to your Supabase project
- Click "Table Editor" in left sidebar
- You should see: vendors, menus, menu_items, orders, pending_orders, customers, messages, idempotency_keys

**Option 2: Command Line**
```bash
psql $DATABASE_URL -c "\dt"
# Should show all tables listed above
```

### Step 4: Create Indexes (Optional, for Performance)

```sql
-- On frequently queried columns
CREATE INDEX idx_orders_vendor_created ON orders(vendor_id, created_at DESC);
CREATE INDEX idx_orders_phone ON orders(customer_phone);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_idempotency_created ON idempotency_keys(created_at);
CREATE INDEX idx_menu_items_vendor ON menu_items(vendor_id);

-- On foreign keys
CREATE INDEX idx_pending_orders_vendor ON pending_orders(vendor_id);
CREATE INDEX idx_customers_vendor_phone ON customers(vendor_id, phone);
```

---

## Deployment Steps

### Option 1: Traditional Server Deployment

```bash
# 1. SSH into server
ssh user@production-server

# 2. Clone repository
git clone https://github.com/IkechukwuEmmanuel/Automation-Bot.git
cd Automation-Bot/Vendor-Connect-Hub

# 3. Install dependencies
pnpm install --frozen-lockfile

# 4. Set environment variables
nano .env
# Add all variables from "Environment Setup" section above
source .env

# 5. Build backend
cd artifacts/api-server
npm run build
cd ../..

# 6. Build frontend
cd artifacts/control-panel
npm run build
cd ../..

# 7. Start with process manager (PM2)
npm install -g pm2
pm2 start "PORT=3000 DATABASE_URL=$DATABASE_URL REDIS_URL=$REDIS_URL node artifacts/api-server/dist/index.mjs" --name "api-server"
pm2 start "PORT=5173 npm run preview --prefix artifacts/control-panel" --name "frontend"
pm2 save
pm2 startup
```

### Option 2: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

WORKDIR /app/artifacts/api-server
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
```

Build and run:
```bash
docker build -t vendor-connect-bot .
docker run -d \
  --name api-server \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e WHATSAPP_TOKEN="..." \
  -e GEMINI_API_KEY="..." \
  vendor-connect-bot
```

### Option 3: Cloud Deployment (Heroku, Railway, Replit)

Platform-specific deployment varies. General flow:
1. Connect GitHub repository
2. Set environment variables in platform dashboard
3. Push to main branch → auto-deploy
4. Verify with health endpoint

### Option 4: Vercel Deployment (Recommended for Serverless) ⭐

Vercel is optimized for Node.js serverless deployment.

#### Step 1: Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Select root directory: `/Vendor-Connect-Hub`
5. Click "Deploy"

#### Step 2: Configure Environment Variables

After importing, go to **Project Settings** → **Environment Variables** and add:

```bash
# Node & Server
NODE_ENV=production
PORT=3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/database

# Cache & Queue (Redis)
REDIS_URL=redis://:password@host:6379

# WhatsApp Integration (CRITICAL)
VERIFY_TOKEN=<generate-strong-random-string>
ACCESS_TOKEN=<your-meta-whatsapp-access-token>

# Optional: AI Extraction
GEMINI_API_KEY=<your-google-api-key>

# Logging
LOG_LEVEL=info
```

⚠️ **IMPORTANT:** `VERIFY_TOKEN` and `ACCESS_TOKEN` should NOT be in git. Generate them in Vercel dashboard only.

#### Step 3: Configure Build & Output

Vercel should auto-detect:
- **Build Command:** `pnpm install && pnpm run build`
- **Output Directory:** `artifacts/api-server/dist`

If not auto-detected, manually set in **Project Settings** → **Build & Development Settings**

#### Step 4: Deploy

Vercel will automatically:
1. ✅ Install dependencies
2. ✅ Run `tsc --noEmit` (TypeScript check)
3. ✅ Run `pnpm run build` (esbuild compilation)
4. ✅ Deploy to serverless functions

**Expected build time:** 2-5 minutes

#### Step 5: Get Your Deployment URL

After successful deployment:
- Your API will be available at: `https://your-project.vercel.app`
- All requests to `/api/*` will route to the Node.js server

#### Step 6: Update Meta Webhook URL

1. Go to Meta Business Platform
2. Navigate to WhatsApp → Configuration
3. Set Webhook URL to: `https://your-project.vercel.app/api/webhook/messages`
4. Set Verify Token to: the `VERIFY_TOKEN` you set in Vercel (not the git value!)
5. Click "Verify and Save"

#### Step 7: Verify Deployment

```bash
# Test health endpoint
curl https://your-project.vercel.app/api/health

# Test webhook verification
curl "https://your-project.vercel.app/api/webhook/messages?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test"
# Expected: HTTP 200 with "test" returned
```

**Vercel Advantages:**
- ✅ Auto-scaling (handles traffic spikes)
- ✅ Global CDN (low latency)
- ✅ Automatic HTTPS
- ✅ Environment variables protected
- ✅ Automatic deployments on git push
- ✅ Built-in monitoring & logs
- ✅ One-click rollbacks

---

## Post-Deployment Verification

### Step 1: Verify Services Running

```bash
# Check API server health (replace with your URL)
curl https://your-deployment-url/api/health
# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-05-22T...",
#   "database": {"ok": true, ...},
#   "redis": {"ok": true, ...}
# }

# For Vercel:
curl https://your-project.vercel.app/api/health
```

### Step 2: Test WhatsApp Webhook

```bash
# 1. Get webhook token from environment
VERIFY_TOKEN="<your-verify-token>"

# 2. Simulate Meta webhook verification
curl "https://your-deployment-url/api/webhook/messages?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=test_challenge"
# Expected: HTTP 200 with "test_challenge" returned

# 3. Verify webhook signature validation (send with invalid signature)
curl -X POST https://your-deployment-url/api/webhook/messages \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=invalid" \
  -d '{"entry":[]}' 
# Expected: HTTP 403 Forbidden (signature rejected)
```

### Step 3: Send Test Message Through Webhook

```bash
# This requires proper X-Hub-Signature-256 header (see webhook-signature.ts for format)
# For testing, use the simulator endpoint instead:
curl -X POST https://your-deployment-url/api/simulator/incoming \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "...",
      "changes": [{
        "value": {
          "messages": [{
            "from": "1234567890",
            "id": "wamid.xxx",
            "timestamp": "1234567890",
            "text": {"body": "Hello, I want 2 chicken"}
          }],
          "metadata": {"phone_number_id": "..."}
        }
      }]
    }]
  }'
```

### Step 3: Test Queue System

```bash
# Check queue status
redis-cli -u $REDIS_URL
> KEYS "bull:*"  # Should show queue keys
> INFO          # Check memory usage
> QUIT

# Monitor queue processing
tail -f /var/log/vendor-connect-api.log | grep -i queue
```

### Step 4: Load Test (Optional)

```bash
# Test with 100 concurrent requests
ab -n 1000 -c 100 http://localhost:3000/api/health

# Or use k6 for more sophisticated testing
k6 run load-test.js --vus 100 --duration 60s
```

---

## Monitoring & Operations

### Key Metrics to Monitor

**Database**:
- Connection pool usage
- Query latency (p50, p99)
- Slow query logs
- Disk usage

**Redis**:
- Memory usage
- Command latency
- Queue depths (incoming, outbound, broadcast)
- Eviction rate

**Application**:
- Request latency (p50, p99, max)
- Error rate
- Message processing rate
- AI timeout frequency
- Circuit breaker state

**System**:
- CPU usage
- Memory usage
- Disk I/O
- Network I/O

### Logging

All logs are structured JSON (Pino):
```json
{"level":30,"time":"2026-05-19T...","pid":1234,"msg":"Message sent","phone":"+1234567890","duration":45}
```

Access logs:
```bash
# Real-time logs
tail -f /var/log/vendor-connect-api.log | jq .

# Filter by level
grep '"level":50' /var/log/vendor-connect-api.log | jq .

# Filter by message type
grep '"msg":"Message sent"' /var/log/vendor-connect-api.log | jq .
```

### Alerting Rules

Configure alerts for:
- API error rate > 1%
- Queue depth > 10,000 (backlog)
- Database connection pool > 90% utilized
- AI timeout rate > 10%
- Message delivery success < 95%
- Server memory > 80%
- Redis memory > 90%

---

## Troubleshooting

### Issue: "Cannot connect to Supabase database"

**Solution**:
```bash
# 1. Verify DATABASE_URL from Supabase dashboard
echo $DATABASE_URL
# Should look like: postgresql://postgres:[password]@[host]:[port]/postgres

# 2. Test connection
psql $DATABASE_URL -c "SELECT 1"

# 3. Check Supabase dashboard
# - Go to Settings → Database → Status
# - Verify database is running
# - Check connection string format

# 4. Check network connectivity
ping [host-from-supabase]
telnet [host-from-supabase] 5432
```

### Issue: "Redis connection refused"

**Solution**:
```bash
# 1. Verify REDIS_URL
echo $REDIS_URL

# 2. Test connection
redis-cli -u $REDIS_URL ping

# 3. Check Redis is running
ps aux | grep redis-server

# 4. Restart Redis
sudo systemctl restart redis-server
```

### Issue: "AI extraction timing out frequently"

**Solution**:
```bash
# 1. Check Gemini API status
curl -s "https://generativelanguage.googleapis.com/v1/models?key=$GEMINI_API_KEY" | head -5

# 2. Verify GEMINI_API_KEY
echo $GEMINI_API_KEY
# Should start with: AIza...

# 3. Check network latency to Google API
ping -c 5 generativelanguage.googleapis.com

# 4. Check API quota
# - Go to Google Cloud Console
# - Generative AI API → Quotas
# - Verify sufficient quota available

# 5. Timeout is hard-limited to 5 seconds
# - Falls back to rule-based extraction if slower
```

### Issue: "Database connection pool exhausted"

**Solution**:
```bash
# 1. Check current connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Increase pool size
export DB_POOL_SIZE=30
export DB_POOL_MIN=10

# 3. Restart application
pm2 restart api-server
```

### Issue: "Queue workers not processing messages"

**Solution**:
```bash
# 1. Check Redis connectivity
redis-cli -u $REDIS_URL PING

# 2. Check queue status
redis-cli -u $REDIS_URL
> KEYS "bull:*"
> LLEN "bull:incoming:jobs"
> QUIT

# 3. Check worker logs
pm2 logs api-server | grep -i queue

# 4. Restart workers
pm2 restart api-server
```

### Issue: "Memory usage growing unbounded"

**Solution**:
```bash
# 1. Check memory usage
ps aux | grep node | grep -v grep

# 2. Check for memory leaks
node --inspect artifacts/api-server/dist/index.mjs
# Then connect with Chrome DevTools to heap dump

# 3. Verify queue concurrency limits are set
grep -i "process(.*," artifacts/api-server/src/lib/queue-workers.ts
# Should show: process(5, ...) or process(10, ...)

# 4. Restart to reset
pm2 restart api-server
```

---

## Maintenance Tasks

### Daily
- Monitor error logs
- Check queue depth (should be <100 normally)
- Verify webhook deliveries working

### Weekly
- Review slow query logs
- Check database size growth
- Verify backup execution

### Monthly
- Update dependencies: `pnpm update`
- Review and optimize slow queries
- Analyze traffic patterns

### Quarterly
- Major version updates: `pnpm upgrade --latest`
- Security audits
- Performance benchmarking

---

## Rollback Procedures

If deployment has issues:

```bash
# 1. Check current version
pm2 show api-server

# 2. Restore from Git
git checkout <previous-commit>
npm run build

# 3. Restart services
pm2 restart all

# 4. Verify
curl http://localhost:3000/api/health
```

Or with Docker:
```bash
# Rollback to previous image
docker stop api-server
docker rm api-server
docker run -d --name api-server -p 3000:3000 vendor-connect-bot:previous-tag
```

---

**For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md)**  
**For quick start, see [README.md](README.md)**
