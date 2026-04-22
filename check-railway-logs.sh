#!/bin/bash
# 查詢 Railway UAT 最新 log（電郵/OTP 相關）
RAILWAY_TOKEN="5418b11d-8c54-43e3-bc07-30f186131dd5"
UAT_SERVICE_ID="3027f3b8-9e09-4dde-ae33-58420f9ccba7"
UAT_ENV_ID="e4da7435-7c7f-4c0c-9ee5-3553e2b8b82f"

ENV="${1:-uat}"  # uat 或 prod
if [ "$ENV" = "prod" ]; then
  SERVICE_ID="fa476daa-0b52-47b1-b124-2abcf5d1f95b"
  ENV_ID="5b37f3ec-13ce-4c4f-83a5-3b3ee52a34c6"
  echo "==> Production logs"
else
  SERVICE_ID="${UAT_SERVICE_ID}"
  ENV_ID="${UAT_ENV_ID}"
  echo "==> UAT logs"
fi

DEPLOY_ID=$(curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer ${RAILWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"{ deployments(first: 1, input: { serviceId: \\\"${SERVICE_ID}\\\", environmentId: \\\"${ENV_ID}\\\" }) { edges { node { id status createdAt } } } }\"}" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);const n=j.data.deployments.edges[0].node;console.log(n.id+'|'+n.status+'|'+n.createdAt)")

IFS='|' read -r ID STATUS CREATED_AT <<< "$DEPLOY_ID"
HKT_TIME=$(node -e "const d=new Date('${CREATED_AT}');d.setHours(d.getHours()+8);console.log(d.toISOString().slice(0,19).replace('T',' ')+' HKT')")
echo "Latest deployment: ${STATUS} at ${HKT_TIME} (${ID})"

FILTER="${2:-all}"

curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer ${RAILWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"{ deploymentLogs(deploymentId: \\\"${ID}\\\", limit: 500) { timestamp message } }\"}" | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8');
const j=JSON.parse(d);
if(j.errors){console.error('Error:',JSON.stringify(j.errors));process.exit(1);}
const logs=j.data?.deploymentLogs??[];
const filter='${FILTER}';
let filtered=logs;
if(filter==='email'||filter==='all'){
  filtered=logs.filter(l=>/\[Email\]|\[Auth\].*[Ee]mail|[Rr]esend|fallback.*otp|otp.*email/i.test(l.message));
}
if(filtered.length===0){
  console.log('未有匹配 log，顯示最後 20 條:');
  filtered=logs.slice(-20);
}
filtered.forEach(l=>{
  const hkt=new Date(l.timestamp);
  hkt.setHours(hkt.getHours()+8);
  console.log(hkt.toISOString().slice(11,19)+' HKT |',l.message);
});
"
