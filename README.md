# LP Representantes — rep.dinastia.uk

Copiada de `DinastIA-UK/dinastia-brain/lp-representantes` (21/ago/2026) e ligada a um mini app Node
que recebe o formulário e grava no Google Sheets.

```
index.html      LP (form #qualForm → POST /api/lead)
brand/ img/     assets (Dockerfile copia só os referenciados)
server/         Express: serve a LP + POST /api/lead → backup JSONL em /data + append no Sheets
  lead.js         campos, validação, ordem das colunas (COLUMNS) — puro, testado em lead.test.js
  sheets.js       service account → aba "Leads" (cria aba e cabeçalho se não existirem)
  server.js       rota, rate-limit (8/10min por IP), honeypot (campo `website`), estáticos
  tools/create-sheet.js  cria a planilha com a SA e compartilha com um e-mail
deploy/
  setup-sheets.sh  gcloud: habilita APIs, cria SA + chave, cria planilha, grava env, redeploya
  set-env.sh       só grava SHEET_ID + SA (base64) no EasyPanel e redeploya
  redeploy.sh      rsync → espelho público DinastIA-UK/rep-site → deployService
```

## Infra

- EasyPanel projeto `site`, serviço **`rep`**, porta 3000, volume `rep-data` em `/data` (backup `leads.jsonl`).
- Source = espelho público **github.com/DinastIA-UK/rep-site** (o repo VSLs é privado). Nunca editar o
  espelho direto: editar aqui e rodar `deploy/redeploy.sh "mensagem"`.
- Domínio `rep.dinastia.uk` criado no painel. DNS no Cloudflare: `A rep → 178.128.45.31`, proxied, SSL Full.
- Teste independente de DNS: `curl -sk --resolve rep.dinastia.uk:443:178.128.45.31 https://rep.dinastia.uk/healthz`
  → `{"ok":true,"sheets":true|false}`.

## Google Sheets (ligado em 21/ago/2026)

- Planilha: https://docs.google.com/spreadsheets/d/1WA4tDGryU71P2IIWZBpnMK1KL-7danbG8IMn1kOwAo4
  (dona: imperador@dinastia.uk, aba `Leads`).
- Service account: `rep-leads@n8n-dinastia-450320.iam.gserviceaccount.com` (projeto GCP
  `n8n-dinastia-450320`), com permissão *Editor* na planilha. Chave em `deploy/sa-rep-leads.json`
  (gitignored; a cópia ativa está na env do serviço no EasyPanel).
- A SA **não consegue criar arquivos no Drive** (restrição do Workspace) — por isso a planilha foi
  criada na conta do usuário e compartilhada com a SA. Pra trocar de planilha: criar, compartilhar
  com a SA e rodar `SHEET_ID=<id> SA_KEY_FILE=deploy/sa-rep-leads.json deploy/set-env.sh`.
- Pra recriar do zero noutro projeto: `gcloud auth login` + `deploy/setup-sheets.sh <projeto> <email>`
  (se a org bloquear chave de SA: `gcloud resource-manager org-policies disable-enforce
  iam.disableServiceAccountKeyCreation --project=<projeto>` e esperar ~2 min).

Env do serviço: `PORT`, `SHEET_ID`, `SHEET_TAB` (default `Leads`), `GOOGLE_SERVICE_ACCOUNT_JSON`
(JSON cru ou base64). Sem `SHEET_ID`/SA o app aceita o lead e guarda só no JSONL (`sheets:false`).

## Rodar local

```
cd server && npm install && npm test
DATA_DIR=/tmp/repdata PORT=3000 node server.js   # http://localhost:3000
```

## Colunas da planilha

`data_hora, nome, email, whatsapp, cidade, experiencia, tech, modelo, disponibilidade, carteira_ativa,
carteira_qtd, carteira_fat, carteira_seg, carteira_reg, motivacao, linkedin, curriculo, carteira_ok,
utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, page_url, user_agent, ip`
