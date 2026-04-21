#!/bin/bash
# Fetch latest Railway UAT deployment logs
# Usage: bash fetch-railway-logs.sh [grep-pattern]
# Example: bash fetch-railway-logs.sh "ProxyEngine"

set -e
RAILWAY_TOKEN_VAL="5418b11d-8c54-43e3-bc07-30f186131dd5"
RAILWAY_UAT_SERVICE_ID="3027f3b8-9e09-4dde-ae33-58420f9ccba7"
RAILWAY_UAT_ENV_ID="e4da7435-7c7f-4c0c-9ee5-3553e2b8b82f"
PATTERN="${1:-}"
OUT="/tmp/railway-uat-logs.txt"

echo "==> Fetching latest deployment ID..."
DEPLOY_ID=$(curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer ${RAILWAY_TOKEN_VAL}" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"query { deployments(first: 1, input: { serviceId: \\\"${RAILWAY_UAT_SERVICE_ID}\\\", environmentId: \\\"${RAILWAY_UAT_ENV_ID}\\\" }) { edges { node { id status createdAt } } } }\"}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.data.deployments.edges[0].node.id)})")

echo "==> Deployment ID: $DEPLOY_ID"
echo "==> Fetching last 500 log lines..."

curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer ${RAILWAY_TOKEN_VAL}" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"query { deploymentLogs(deploymentId: \\\"${DEPLOY_ID}\\\", limit: 500) { message timestamp severity } }\"}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const logs=(j.data&&j.data.deploymentLogs)||[];logs.forEach(l=>{const ts=(l.timestamp||'').slice(0,19).replace('T',' ');const sev=(l.severity||'').padEnd(5);console.log(ts+' ['+sev+'] '+(l.message||''))})})" > "$OUT"

LINES=$(wc -l < "$OUT")
echo "==> Saved $LINES lines to $OUT"

if [ -n "$PATTERN" ]; then
  echo ""
  echo "==> Matching '$PATTERN':"
  echo "─────────────────────────────────────"
  grep --color=never -E "$PATTERN" "$OUT" || echo "(no matches)"
fi
