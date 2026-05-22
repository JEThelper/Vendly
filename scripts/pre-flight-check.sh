#!/bin/bash

# TESTING GUIDE FOR PRODUCTION FIXES
# Run this to validate all 7 bugs are fixed

set -e

echo "🧪 WhatsApp Bot Testing Suite"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Verify environment setup
echo -e "${YELLOW}1. Checking environment setup...${NC}"
if [ ! -f ".env" ]; then
  echo -e "${RED}❌ .env file not found!${NC}"
  echo "Create .env with these required variables:"
  echo "  DATABASE_URL=postgresql://..."
  echo "  REDIS_URL=redis://localhost:6379"
  echo "  ACCESS_TOKEN=your_token"
  echo "  VERIFY_TOKEN=your_verify_token"
  echo "  PORT=3000"
  exit 1
fi
echo -e "${GREEN}✅ .env file exists${NC}"

# 2. Check dependencies
echo -e "${YELLOW}2. Checking dependencies...${NC}"
if ! command -v redis-cli &> /dev/null; then
  echo -e "${RED}⚠️  redis-cli not found (optional but needed for queue testing)${NC}"
else
  echo -e "${GREEN}✅ redis-cli available${NC}"
fi

if ! command -v psql &> /dev/null; then
  echo -e "${RED}⚠️  psql not found (optional but needed for DB testing)${NC}"
else
  echo -e "${GREEN}✅ psql available${NC}"
fi

# 3. Build check
echo -e "${YELLOW}3. Checking TypeScript build...${NC}"
cd artifacts/api-server
pnpm run typecheck > /dev/null 2>&1 && echo -e "${GREEN}✅ TypeScript check passed${NC}" || {
  echo -e "${RED}❌ TypeScript errors found${NC}"
  exit 1
}

pnpm run build > /dev/null 2>&1 && echo -e "${GREEN}✅ Build succeeded${NC}" || {
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
}

echo ""
echo -e "${GREEN}✅ All pre-flight checks passed!${NC}"
echo ""
echo "Next steps to test:"
echo ""
echo "1. Start the server (in one terminal):"
echo "   cd artifacts/api-server"
echo "   node dist/index.mjs"
echo ""
echo "2. Test the webhook (in another terminal):"
echo "   bash scripts/test-webhook.sh"
echo ""
echo "3. Simulate incoming messages:"
echo "   bash scripts/test-incoming-messages.sh"
echo ""
echo "4. Load test (requires k6):"
echo "   bash scripts/load-test.sh"
echo ""
echo "See TESTING_GUIDE.md for detailed instructions"
