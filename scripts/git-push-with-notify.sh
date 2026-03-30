#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# git-push-with-notify.sh
# 推送至 GitHub，失敗時透過 Manus Notification Service 通知擁有者
#
# 使用方式：
#   bash scripts/git-push-with-notify.sh [remote] [branch]
#   預設：remote=github, branch=main
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REMOTE="${1:-github}"
BRANCH="${2:-main}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── 讀取環境變數（優先從 .env 載入，再用系統環境變數）─────────────────────
if [ -f "$PROJECT_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

FORGE_API_URL="${BUILT_IN_FORGE_API_URL:-}"
FORGE_API_KEY="${BUILT_IN_FORGE_API_KEY:-}"

# ── 通知函數 ──────────────────────────────────────────────────────────────────
send_notification() {
  local title="$1"
  local content="$2"

  if [ -z "$FORGE_API_URL" ] || [ -z "$FORGE_API_KEY" ]; then
    echo "[Notify] 缺少 BUILT_IN_FORGE_API_URL 或 BUILT_IN_FORGE_API_KEY，跳過通知" >&2
    return 1
  fi

  local endpoint="${FORGE_API_URL%/}/webdevtoken.v1.WebDevService/SendNotification"

  curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$endpoint" \
    -H "accept: application/json" \
    -H "authorization: Bearer $FORGE_API_KEY" \
    -H "content-type: application/json" \
    -H "connect-protocol-version: 1" \
    -d "{\"title\":$(printf '%s' "$title" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\"content\":$(printf '%s' "$content" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
}

# ── 執行 git push ─────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"

echo "[GitHub Push] 推送 $REMOTE/$BRANCH ..."
PUSH_OUTPUT=$(git push "$REMOTE" "$BRANCH" 2>&1)
PUSH_EXIT=$?

if [ $PUSH_EXIT -eq 0 ]; then
  echo "[GitHub Push] 成功 ✓"
  echo "$PUSH_OUTPUT"
  exit 0
fi

# ── 推送失敗：發送通知 ────────────────────────────────────────────────────────
echo "[GitHub Push] 失敗！正在發送通知..." >&2
echo "$PUSH_OUTPUT" >&2

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "無法取得")

TITLE="⚠️ GitHub 推送失敗 — bb-coin-shop"
CONTENT="推送至 ${REMOTE}/${BRANCH} 失敗。

時間：${TIMESTAMP}
最新 Commit：${LAST_COMMIT}

錯誤訊息：
${PUSH_OUTPUT}

請手動執行：git push ${REMOTE} ${BRANCH}"

HTTP_STATUS=$(send_notification "$TITLE" "$CONTENT" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "[Notify] 通知已成功發送 (HTTP $HTTP_STATUS)" >&2
else
  echo "[Notify] 通知發送失敗 (HTTP $HTTP_STATUS)，請手動檢查 GitHub 推送狀態" >&2
fi

exit $PUSH_EXIT
