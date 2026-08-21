#!/usr/bin/env bash
# Fecha a integracao com o Google Sheets de ponta a ponta.
# Pre-requisito: `gcloud auth login` feito com uma conta que tenha acesso ao projeto GCP.
# Uso: deploy/setup-sheets.sh [gcp-project] [email-dono-da-planilha]
#      SHEET_ID=<id> deploy/setup-sheets.sh   -> usa planilha ja criada (compartilhar com a SA antes)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${1:-grupor3-503009}"
OWNER="${2:-imperador@dinastia.uk}"
SA="rep-leads"
SA_EMAIL="$SA@$PROJECT.iam.gserviceaccount.com"
KEY="$HERE/deploy/sa-rep-leads.json"   # gitignored

echo "▸ APIs"
gcloud services enable sheets.googleapis.com drive.googleapis.com --project "$PROJECT" >/dev/null
echo "▸ Service account $SA_EMAIL"
gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$SA" --display-name "LP Representantes — leads" --project "$PROJECT" >/dev/null
if [ ! -f "$KEY" ]; then
  echo "▸ Chave"
  gcloud iam service-accounts keys create "$KEY" --iam-account "$SA_EMAIL" --project "$PROJECT" >/dev/null
fi
if [ -n "${SHEET_ID:-}" ]; then
  echo "▸ Usando planilha existente $SHEET_ID — ela precisa estar compartilhada (Editor) com: $SA_EMAIL"
else
  echo "▸ Planilha (criada pela SA e compartilhada com $OWNER)"
  cd "$HERE/server"
  OUT="$(GOOGLE_SERVICE_ACCOUNT_JSON="$(cat "$KEY")" node tools/create-sheet.js "$OWNER")"
  echo "$OUT"
  SHEET_ID="$(echo "$OUT" | sed -n 's/^SHEET_ID=//p')"
fi
echo "▸ Env no EasyPanel + redeploy"
SHEET_ID="$SHEET_ID" SA_KEY_FILE="$KEY" "$HERE/deploy/set-env.sh"
