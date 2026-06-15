#!/bin/bash
# Deploy script: Push bb-coin-shop to GitHub + trigger Railway deployment
# Usage:
#   UAT only:        cd bb-coin-shop && bash deploy.sh "commit message"
#   UAT + Prod:      cd bb-coin-shop && DEPLOY_PROD=true bash deploy.sh "commit message"
#   Prod only (no push): cd bb-coin-shop && bash deploy.sh --prod-only

set -e

COMMIT_MSG="${1:-"chore: update from Replit $(date '+%Y-%m-%d %H:%M')"}"
GITHUB_REPO="https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/hongxcollections/bb-coin-shop-20260328.git"
RAILWAY_TOKEN_VAL="5418b11d-8c54-43e3-bc07-30f186131dd5"

# UAT
RAILWAY_UAT_SERVICE_ID="3027f3b8-9e09-4dde-ae33-58420f9ccba7"
RAILWAY_UAT_ENV_ID="e4da7435-7c7f-4c0c-9ee5-3553e2b8b82f"

# Production (watches main branch)
RAILWAY_PROD_SERVICE_ID="fa476daa-0b52-47b1-b124-2abcf5d1f95b"
RAILWAY_PROD_ENV_ID="5b37f3ec-13ce-4c4f-83a5-3b3ee52a34c6"

# --prod-only: just trigger Railway Production redeploy from latest main commit, no git push
if [ "$1" = "--prod-only" ]; then
  echo "==> Triggering Railway PRODUCTION deployment from latest main commit (no git push)..."
  PROD_RESULT=$(curl -s -X POST "https://backboard.railway.app/graphql/v2" \
    -H "Authorization: Bearer ${RAILWAY_TOKEN_VAL}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"mutation { serviceInstanceDeploy(serviceId: \\\"${RAILWAY_PROD_SERVICE_ID}\\\", environmentId: \\\"${RAILWAY_PROD_ENV_ID}\\\", latestCommit: true) }\"}" 2>/dev/null)
  if echo "$PROD_RESULT" | grep -q '"serviceInstanceDeploy":true'; then
    echo "✅ Railway PRODUCTION deployment triggered (latest main)!"
    echo "   Production: https://hongxcollections.com"
  else
    echo "❌ Production trigger failed: $PROD_RESULT"
  fi
  exit 0
fi

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

SKIP_CLONE="${SKIP_CLONE:-false}"
if [ "$SKIP_CLONE" = "true" ] && [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR/.git" ]; then
  echo "==> SKIP_CLONE: using existing dir $TMP_DIR"
else
  TMP_DIR=$(mktemp -d)

  echo "==> Cloning GitHub repo (main branch)..."
  git clone --depth=1 --branch main "$GITHUB_REPO" "$TMP_DIR" 2>&1

  echo "==> Copying latest files from Replit..."
  if [ -n "${FAST_FILES:-}" ]; then
    echo "   FAST_FILES mode: copying only specified files"
    for f in $FAST_FILES; do
      mkdir -p "$TMP_DIR/$(dirname "$f")"
      cp "$SOURCE_DIR/$f" "$TMP_DIR/$f"
    done
  else
    find "$TMP_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
    tar -cf - \
      --exclude='./.git' \
      --exclude='./node_modules' \
      --exclude='./dist' \
      --exclude='./.env' \
      -C "$SOURCE_DIR" . | tar -xf - -C "$TMP_DIR"
  fi
fi

echo "==> Checking for changes..."
cd "$TMP_DIR"
git config user.email "ywkyee@gmail.com"
git config user.name "BB Coin Shop"

FORCE_UAT="${FORCE_UAT:-false}"

if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  if [ "$FORCE_UAT" != "true" ]; then
    echo "==> No changes to deploy."
    cd /
    rm -rf "$TMP_DIR"
    exit 0
  fi
  echo "==> No changes to main, but forcing uat branch update..."
else
  echo "==> Staging and committing to main..."
  git add -A
  git status --short
  git commit -m "$COMMIT_MSG"
  git push origin main
fi

echo "==> Pushing main → uat (Railway UAT watches uat branch, auto-deploys via webhook)..."
git push origin main:uat --force

echo "==> Triggering Railway UAT deployment via API (belt-and-suspenders)..."
UAT_RESULT=$(curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer ${RAILWAY_TOKEN_VAL}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"mutation { serviceInstanceDeploy(serviceId: \\\"${RAILWAY_UAT_SERVICE_ID}\\\", environmentId: \\\"${RAILWAY_UAT_ENV_ID}\\\", latestCommit: true) }\"}" 2>/dev/null)
if echo "$UAT_RESULT" | grep -q '"serviceInstanceDeploy":true'; then
  echo "==> Railway UAT deployment triggered via API!"
else
  echo "==> (Webhook fallback) UAT API trigger result: $UAT_RESULT"
fi

# Optionally deploy to Production (uses latestCommit:true to pull newest main code)
DEPLOY_PROD="${DEPLOY_PROD:-false}"
if [ "$DEPLOY_PROD" = "true" ]; then
  echo "==> Triggering Railway PRODUCTION deployment (latest main) via API..."
  PROD_RESULT=$(curl -s -X POST "https://backboard.railway.app/graphql/v2" \
    -H "Authorization: Bearer ${RAILWAY_TOKEN_VAL}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"mutation { serviceInstanceDeploy(serviceId: \\\"${RAILWAY_PROD_SERVICE_ID}\\\", environmentId: \\\"${RAILWAY_PROD_ENV_ID}\\\", latestCommit: true) }\"}" 2>/dev/null)
  if echo "$PROD_RESULT" | grep -q '"serviceInstanceDeploy":true'; then
    echo "==> Railway PRODUCTION deployment triggered!"
  else
    echo "==> Warning: Production trigger may have failed: $PROD_RESULT"
  fi
fi

echo ""
echo "✅ Done! Code pushed to GitHub (main + uat branch), Railway UAT is building."
echo "   UAT:        https://uat.hongxcollections.com"
if [ "$DEPLOY_PROD" = "true" ]; then
  echo "   Production: https://hongxcollections.com"
fi
echo "   Railway dashboard: https://railway.app/project/ef35a97e-c480-4a21-b600-0288f940d229"
echo ""

cd /
rm -rf "$TMP_DIR"
