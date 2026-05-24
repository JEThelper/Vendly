# Vercel Deployment Guide

This is a simple, direct guide to deploy `Vendor-Connect-Hub` on Vercel.

## 1. Fix the Vercel config

The root `vercel.json` file must define `NODE_ENV` as a string.

The config is already fixed to:

```json
{
  "version": 2,
  "buildCommand": "pnpm install && pnpm run build",
  "framework": "other",
  "env": {
    "NODE_ENV": "production"
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/dist/index.mjs",
      "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    },
    {
      "src": "/(.*)",
      "dest": "/dist/index.mjs"
    }
  ],
  "functions": {
    "artifacts/api-server/dist/index.mjs": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "outputDirectory": "artifacts/api-server/dist"
}
```

## 2. Connect your repo to Vercel

1. Go to `https://vercel.com` and log in.
2. Click `New Project`.
3. Import the GitHub repository `IkechukwuEmmanuel/Automation-Bot`.
4. Use the root folder `/` as the project root.
5. Vercel will detect the repo and use the existing `vercel.json` automatically.

## 3. Set environment variables in Vercel

Open your Vercel project, then go to `Settings` → `Environment Variables`.

Add these variables for `Production` and `Preview` as needed:

- `DATABASE_URL`
- `REDIS_URL`
- `VERIFY_TOKEN`
- `ACCESS_TOKEN`
- `GEMINI_API_KEY` (optional)
- `LOG_LEVEL` (optional, e.g. `info`)

You do not need to add `NODE_ENV` here because Vercel already sets it in `vercel.json`.

## 4. Deploy

Once the repo is imported and env vars are set:

- Click `Deploy` in the Vercel dashboard.
- Or run locally from the repo root:

```bash
cd /workspaces/Automation-Bot/Vendor-Connect-Hub
vercel --prod
```

## 5. Verify deployment

After deploy completes:

- Open the Vercel deployment URL.
- Confirm the site loads.
- If your API is used, verify `/api/health` or your webhook endpoint returns a response.

## 6. Notes

- `buildCommand` is `pnpm install && pnpm run build`.
- Vercel will build the monorepo from the root.
- Set secrets in the Vercel dashboard, not in `vercel.json`.
- The project uses `artifacts/api-server/dist` for server output.

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
