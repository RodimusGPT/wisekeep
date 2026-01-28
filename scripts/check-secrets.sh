#!/bin/bash
# Pre-deploy check for required Supabase secrets
# Run this before deploying edge functions to catch configuration issues

set -e

echo "🔍 Checking Supabase Edge Function secrets..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Required secrets for edge functions
REQUIRED_SECRETS=(
  "GROQ_API_KEY"
  "OPENAI_API_KEY"
)

# Optional secrets (warn if missing, don't fail)
OPTIONAL_SECRETS=(
  "GOOGLE_CLOUD_STT_API_KEY"
)

# Get list of configured secrets
echo "Fetching configured secrets from Supabase..."
CONFIGURED_SECRETS=$(supabase secrets list 2>/dev/null | tail -n +2 | awk '{print $1}' || echo "")

if [ -z "$CONFIGURED_SECRETS" ]; then
  echo -e "${RED}❌ Failed to fetch secrets. Make sure you're logged in:${NC}"
  echo "   supabase login"
  echo "   supabase link --project-ref YOUR_PROJECT_REF"
  exit 1
fi

echo ""
MISSING_REQUIRED=0
MISSING_OPTIONAL=0

# Check required secrets
echo "Required secrets:"
for secret in "${REQUIRED_SECRETS[@]}"; do
  if echo "$CONFIGURED_SECRETS" | grep -q "^$secret$"; then
    echo -e "  ${GREEN}✓${NC} $secret"
  else
    echo -e "  ${RED}✗${NC} $secret ${RED}(MISSING - deployment will fail)${NC}"
    MISSING_REQUIRED=1
  fi
done

echo ""

# Check optional secrets
echo "Optional secrets:"
for secret in "${OPTIONAL_SECRETS[@]}"; do
  if echo "$CONFIGURED_SECRETS" | grep -q "^$secret$"; then
    echo -e "  ${GREEN}✓${NC} $secret"
  else
    echo -e "  ${YELLOW}⚠${NC} $secret ${YELLOW}(not configured - some features disabled)${NC}"
    MISSING_OPTIONAL=1
  fi
done

echo ""

# Summary
if [ $MISSING_REQUIRED -eq 1 ]; then
  echo -e "${RED}❌ Missing required secrets. Set them with:${NC}"
  echo ""
  echo "   supabase secrets set GROQ_API_KEY=your_groq_api_key"
  echo "   supabase secrets set OPENAI_API_KEY=your_openai_api_key"
  echo ""
  exit 1
fi

if [ $MISSING_OPTIONAL -eq 1 ]; then
  echo -e "${YELLOW}⚠ Optional secrets missing. Features affected:${NC}"
  echo "   - GOOGLE_CLOUD_STT_API_KEY: VIP long recordings (>25 min) will use Groq chunking instead"
  echo ""
  echo "   To enable Google STT for long recordings:"
  echo "   supabase secrets set GOOGLE_CLOUD_STT_API_KEY=your_google_api_key"
  echo ""
fi

echo -e "${GREEN}✅ All required secrets configured. Safe to deploy!${NC}"
echo ""
echo "Deploy with:"
echo "   supabase functions deploy process-recording"
