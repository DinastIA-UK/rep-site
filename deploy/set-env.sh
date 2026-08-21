#!/usr/bin/env bash
# Grava SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON (base64) no servico `rep` do EasyPanel e redeploya.
# Uso: SHEET_ID=... SA_KEY_FILE=deploy/sa-rep-leads.json deploy/set-env.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
set -a; source "$ROOT/.env"; set +a
: "${SHEET_ID:?defina SHEET_ID}"; : "${SA_KEY_FILE:?defina SA_KEY_FILE}"
B64="$(base64 < "$SA_KEY_FILE" | tr -d '\n')"
ENV_TXT="PORT=3000\nSHEET_ID=$SHEET_ID\nSHEET_TAB=${SHEET_TAB:-Leads}\nGOOGLE_SERVICE_ACCOUNT_JSON=$B64"
ep() { curl -s -X POST "https://$EASYPANEL_DOMAIN/api/trpc/$1" -H "Authorization: Bearer $EASYPANEL_TOKEN" -H 'content-type: application/json' -d "$2"; }
python3 - "$ENV_TXT" <<'PY' > /tmp/rep-env.json
import json,sys; print(json.dumps({"json":{"projectName":"site","serviceName":"rep","env":sys.argv[1].replace("\\n","\n"),"createDotEnv":False}}))
PY
ep services.app.updateEnv "$(cat /tmp/rep-env.json)"; rm -f /tmp/rep-env.json
ep services.app.deployService '{"json":{"projectName":"site","serviceName":"rep","forceRebuild":false}}'
echo; echo "✓ env gravada; aguardando container..."; sleep 25
curl -sk --resolve rep.dinastia.uk:443:178.128.45.31 https://rep.dinastia.uk/healthz; echo
