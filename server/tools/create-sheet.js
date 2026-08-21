// Cria a planilha com a service account e compartilha com um e-mail (editor).
// Uso: GOOGLE_SERVICE_ACCOUNT_JSON="$(cat sa.json)" node tools/create-sheet.js imperador@dinastia.uk
import { google } from 'googleapis';
import { COLUMNS } from '../lead.js';

const shareWith = process.argv[2];
if (!shareWith) { console.error('uso: node tools/create-sheet.js <email-para-compartilhar>'); process.exit(1); }
const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!raw) { console.error('defina GOOGLE_SERVICE_ACCOUNT_JSON'); process.exit(1); }
const creds = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
creds.private_key = creds.private_key.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'] });
const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

const tab = process.env.SHEET_TAB || 'Leads';
const { data } = await sheets.spreadsheets.create({
  requestBody: { properties: { title: 'Leads — Representantes DinastIA (rep.dinastia.uk)' }, sheets: [{ properties: { title: tab, gridProperties: { frozenRowCount: 1 } } }] },
});
await sheets.spreadsheets.values.update({ spreadsheetId: data.spreadsheetId, range: `${tab}!A1`, valueInputOption: 'RAW', requestBody: { values: [COLUMNS] } });
await drive.permissions.create({ fileId: data.spreadsheetId, sendNotificationEmail: false, requestBody: { type: 'user', role: 'writer', emailAddress: shareWith } });
console.log('SHEET_ID=' + data.spreadsheetId);
console.log('URL=' + data.spreadsheetUrl);
