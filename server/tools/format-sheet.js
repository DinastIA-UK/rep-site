// Reaplica cabecalho + formatacao na aba de leads e remove abas padrao vazias (Sheet1/Página1).
// Uso: GOOGLE_SERVICE_ACCOUNT_JSON="$(cat ../deploy/sa-rep-leads.json)" SHEET_ID=... node tools/format-sheet.js
import { google } from 'googleapis';
import { HEADER_ROW } from '../lead.js';
import { formatHeader } from '../sheets.js';

const spreadsheetId = process.env.SHEET_ID;
const tab = process.env.SHEET_TAB || 'Leads';
const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!spreadsheetId || !raw) { console.error('defina SHEET_ID e GOOGLE_SERVICE_ACCOUNT_JSON'); process.exit(1); }
const creds = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
creds.private_key = creds.private_key.replace(/\\n/g, '\n');
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title,index)' });
let leads = meta.data.sheets.find((s) => s.properties.title === tab);
if (!leads) {
  const r = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab, index: 0 } } }] } });
  leads = r.data.replies[0].addSheet;
}
const requests = [{ updateSheetProperties: { properties: { sheetId: leads.properties.sheetId, index: 0 }, fields: 'index' } }];
for (const s of meta.data.sheets) {
  if (s.properties.title === tab) continue;
  const v = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${s.properties.title}'!A1:Z50` });
  if (!v.data.values?.length) requests.push({ deleteSheet: { sheetId: s.properties.sheetId } });
}
await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A1`, valueInputOption: 'RAW', requestBody: { values: [HEADER_ROW] } });
await formatHeader(sheets, spreadsheetId, leads.properties.sheetId);
console.log('ok: aba', tab, 'na frente, cabecalho formatado');
