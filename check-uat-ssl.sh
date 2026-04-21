#!/usr/bin/env bash
# 驗證 uat.hongxcollections.com SSL + DNS 狀態
set -e
DOMAIN="uat.hongxcollections.com"

echo "=== 1. DNS A/CNAME 解析 ==="
getent hosts "$DOMAIN" || echo "解析失敗"
echo

echo "=== 2. SSL 證書 ==="
CERT_INFO=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null)
echo "$CERT_INFO"
echo

if echo "$CERT_INFO" | grep -q "$DOMAIN"; then
  echo "✅ 證書包含 $DOMAIN — SSL 已正常！"
elif echo "$CERT_INFO" | grep -q "up.railway.app"; then
  echo "❌ 仍係 Railway 預設證書 — Custom domain 未喺 Railway 加成功，或 Cloudflare 仲係橙雲"
else
  echo "⚠️  非預期證書，請人手檢查"
fi
echo

echo "=== 3. HTTPS 200 OK 測試 ==="
HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" "https://$DOMAIN/" -m 10 2>&1 || echo "FAIL")
echo "HTTP code: $HTTP_CODE"
[ "$HTTP_CODE" = "200" ] && echo "✅ 網站可以正常開啟"
