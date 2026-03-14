#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SulMotor – Supabase Production Deployment Script
# Project: imkzkvlktrixaxougqie
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxx   # Your Supabase PAT
#   export DB_PASSWORD=your_database_password        # Your Supabase DB password
#   bash deploy.sh
#
# Or pass as arguments:
#   bash deploy.sh <SUPABASE_ACCESS_TOKEN> <DB_PASSWORD>
#
# Get your PAT from: https://supabase.com/dashboard/account/tokens
# Get your DB password from: https://supabase.com/dashboard/project/imkzkvlktrixaxougqie/settings/database
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_REF="imkzkvlktrixaxougqie"
SUPABASE_URL="https://imkzkvlktrixaxougqie.supabase.co"

# From .env.server
MP_ACCESS_TOKEN="APP_USR-7239440808267582-031221-15802be9b3427f5b9e1e29d49413ed02-2697630578"
CRON_SECRET_KEY="bgUZaN9ChtIX6CuqzIX4VycQZTU36nRNrfQ3Lqy2_5c"

# ── Credentials (from args or env) ────────────────────────────────────────────
PAT="${SUPABASE_ACCESS_TOKEN:-${1:-}}"
DB_PWD="${DB_PASSWORD:-${2:-}}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()     { echo -e "${CYAN}[deploy]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

if [[ -z "$PAT" ]]; then
  error "SUPABASE_ACCESS_TOKEN not set. Get yours from https://supabase.com/dashboard/account/tokens"
fi

export SUPABASE_ACCESS_TOKEN="$PAT"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Install supabase CLI if needed ────────────────────────────────────────────
if ! command -v supabase &> /dev/null; then
  log "Installing Supabase CLI..."
  curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
    -o /tmp/supabase.tar.gz
  tar -xzf /tmp/supabase.tar.gz -C /tmp
  sudo mv /tmp/supabase /usr/local/bin/supabase
  chmod +x /usr/local/bin/supabase
fi
log "Supabase CLI: $(supabase --version)"

# ── Step 1: Link project ──────────────────────────────────────────────────────
log "Linking to Supabase project $PROJECT_REF..."
cd "$SCRIPT_DIR"

if [[ -n "$DB_PWD" ]]; then
  echo "$DB_PWD" | supabase link --project-ref "$PROJECT_REF" -p "$DB_PWD" 2>&1 || true
else
  supabase link --project-ref "$PROJECT_REF" 2>&1 || true
fi
success "Project linked: $PROJECT_REF"

# ── Step 2: Apply migrations ──────────────────────────────────────────────────
log "Applying database migrations..."

if [[ -n "$DB_PWD" ]]; then
  # Direct push using DB URL (pooler connection)
  DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PWD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
  supabase db push --db-url "$DB_URL" 2>&1 && success "Migrations applied via db push --db-url"
else
  # Linked push (requires linked project)
  supabase db push 2>&1 && success "Migrations applied via db push"
fi

# ── Step 3: Deploy Edge Functions ─────────────────────────────────────────────
log "Deploying Edge Functions..."

FUNCTIONS=(
  "create-payment"
  "mercadopago-webhook"
  "payment-status"
  "boost-plans"
  "orders"
  "expire-boosts"
)

for fn in "${FUNCTIONS[@]}"; do
  log "  Deploying $fn..."
  supabase functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt \
    --use-api \
    2>&1 && success "  $fn deployed"
done

# ── Step 4: Set secrets ───────────────────────────────────────────────────────
log "Setting Edge Function secrets..."

supabase secrets set \
  MP_ACCESS_TOKEN="$MP_ACCESS_TOKEN" \
  CRON_SECRET_KEY="$CRON_SECRET_KEY" \
  --project-ref "$PROJECT_REF" 2>&1

success "Secrets set: MP_ACCESS_TOKEN, CRON_SECRET_KEY"

# If service role key is available, set it too
if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  supabase secrets set \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    --project-ref "$PROJECT_REF" 2>&1
  success "Secret set: SUPABASE_SERVICE_ROLE_KEY"
else
  warn "SUPABASE_SERVICE_ROLE_KEY not set. Set it separately:"
  warn "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key> --project-ref $PROJECT_REF"
fi

# ── Step 5: Verify functions ──────────────────────────────────────────────────
log "Verifying deployed functions..."
supabase functions list --project-ref "$PROJECT_REF" 2>&1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Edge Function URLs:"
for fn in "${FUNCTIONS[@]}"; do
  echo "  ${SUPABASE_URL}/functions/v1/${fn}"
done
echo ""
echo "Webhook URL for Mercado Pago Dashboard:"
echo "  ${SUPABASE_URL}/functions/v1/mercadopago-webhook"
echo ""
echo "Subscribe to events: order.processed, order.cancelled, order.refunded, payment"
echo ""
echo "Frontend .env:"
echo "  VITE_SUPABASE_URL=${SUPABASE_URL}"
echo "  VITE_SUPABASE_ANON_KEY=<your-anon-key>"
echo "  VITE_MP_PUBLIC_KEY=APP_USR-636eb3bb-1a5c-43e0-9077-d5d7d2b39a11"
