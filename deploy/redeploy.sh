#!/usr/bin/env bash
# Sincroniza LPS/REPRESENTANTES -> espelho publico DinastIA-UK/rep-site e redeploya no EasyPanel.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
set -a; source "$ROOT/.env"; set +a
TMP="$(mktemp -d)"; git clone -q git@github.com:DinastIA-UK/rep-site.git "$TMP/rep-site"
rsync -a --delete --exclude .git --exclude node_modules --exclude '*.jsonl' --exclude .DS_Store --exclude 'deploy/sa-*.json' "$HERE/" "$TMP/rep-site/"
cd "$TMP/rep-site"
if git diff --quiet && [ -z "$(git status --porcelain)" ]; then echo "nada a subir"; exit 0; fi
git status --short | head -40
git add -A && git commit -qm "${1:-Atualiza LP Representantes}" && git push -q
curl -s -X POST "https://$EASYPANEL_DOMAIN/api/trpc/services.app.deployService" -H "Authorization: Bearer $EASYPANEL_TOKEN" -H 'content-type: application/json' -d '{"json":{"projectName":"site","serviceName":"rep","forceRebuild":true}}'
echo; echo "✓ deploy disparado"
