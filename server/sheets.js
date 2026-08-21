// Grava linhas no Google Sheets via service account.
// Env: GOOGLE_SERVICE_ACCOUNT_JSON (conteudo do JSON da SA, ou base64 dele), SHEET_ID, SHEET_TAB (opcional, default "Leads").

import { google } from 'googleapis';
import { COLUMNS, HEADER_ROW, COLUMN_WIDTHS } from './lead.js';

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

// Cabecalho em negrito sobre fundo escuro, linha 1 congelada, filtro e larguras — idempotente.
export async function formatHeader(sheets, spreadsheetId, sheetId) {
  const n = COLUMNS.length;
  const requests = [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: n },
      cell: { userEnteredFormat: {
        backgroundColor: { red: 0.043, green: 0.071, blue: 0.102 },
        textFormat: { bold: true, foregroundColor: { red: 0.176, green: 0.839, blue: 0.627 }, fontSize: 10 },
        verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP',
      } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)',
    } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 34 }, fields: 'pixelSize' } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'dd/mm/yyyy hh:mm' } } },
      fields: 'userEnteredFormat.numberFormat',
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: n },
      cell: { userEnteredFormat: { wrapStrategy: 'CLIP', verticalAlignment: 'TOP' } },
      fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
    } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: n } } } },
    ...COLUMNS.map((c, i) => ({ updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: COLUMN_WIDTHS[c] ?? 150 }, fields: 'pixelSize',
    } })),
  ];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function ensureTabAndHeader(sheets, spreadsheetId) {
  if (headerChecked) return;
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  let tab = (meta.data.sheets || []).find((s) => s.properties.title === tabName());
  if (!tab) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName(), index: 0 } } }] },
    });
    tab = res.data.replies[0].addSheet;
  }
  const first = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName()}!1:1` });
  const row1 = first.data.values?.[0] || [];
  if (row1.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName()}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER_ROW] },
    });
    await formatHeader(sheets, spreadsheetId, tab.properties.sheetId);
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
    insertDataOption: 'OVERWRITE',
    requestBody: { values: [row] },
  });
}
