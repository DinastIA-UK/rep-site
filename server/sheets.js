// Grava linhas no Google Sheets via service account.
// Env: GOOGLE_SERVICE_ACCOUNT_JSON (conteudo do JSON da SA, ou base64 dele), SHEET_ID, SHEET_TAB (opcional, default "Leads").

import { google } from 'googleapis';
import { COLUMNS } from './lead.js';

function readCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const txt = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const creds = JSON.parse(txt);
  // Em env var o \n da private_key costuma chegar escapado.
  if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  return creds;
}

let client = null;
let headerChecked = false;

export function sheetsConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.SHEET_ID);
}

function getClient() {
  if (client) return client;
  const creds = readCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  client = google.sheets({ version: 'v4', auth });
  return client;
}

function tabName() {
  return process.env.SHEET_TAB || 'Leads';
}

async function ensureTabAndHeader(sheets, spreadsheetId) {
  if (headerChecked) return;
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);
  if (!titles.includes(tabName())) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName() } } }] },
    });
  }
  const first = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName()}!1:1` });
  const row1 = first.data.values?.[0] || [];
  if (row1.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName()}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [COLUMNS] },
    });
  }
  headerChecked = true;
}

export async function appendLeadRow(row) {
  const spreadsheetId = process.env.SHEET_ID;
  const sheets = getClient();
  await ensureTabAndHeader(sheets, spreadsheetId);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName()}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}
