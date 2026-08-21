// Serve a LP estatica (../) e recebe o formulario em POST /api/lead.
// Cada lead: valida -> grava backup local (JSONL) -> append no Google Sheets.

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLead, normalizeLead, leadToRow } from './lead.js';
import { appendLeadRow, sheetsConfigured } from './sheets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || '/data';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // atras do Traefik do EasyPanel
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// ── rate limit simples por IP (memoria) ──
const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_PER_WINDOW;
}

function backupLocal(lead) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(path.join(DATA_DIR, 'leads.jsonl'), JSON.stringify(lead) + '\n');
    return true;
  } catch (err) {
    console.error('[backup] falhou:', err.message);
    return false;
  }
}

app.get('/healthz', (_req, res) => res.json({ ok: true, sheets: sheetsConfigured() }));

app.post('/api/lead', async (req, res) => {
  const ip = req.ip;
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const body = req.body || {};
  if (body.website) return res.json({ ok: true }); // honeypot: bot preencheu campo invisivel

  const errors = validateLead(body);
  if (errors.length) return res.status(400).json({ ok: false, error: 'invalid', fields: errors });

  const lead = normalizeLead(body, { ip, userAgent: req.get('user-agent') });
  const saved = backupLocal(lead);

  if (!sheetsConfigured()) {
    console.warn('[lead] Sheets nao configurado; lead so no backup local', lead.email);
    return res.json({ ok: true, sheets: false });
  }

  try {
    await appendLeadRow(leadToRow(lead));
    console.log('[lead] gravado', lead.email);
    return res.json({ ok: true, sheets: true });
  } catch (err) {
    console.error('[sheets] falhou:', err.message);
    // O lead ja esta no backup local; nao mostramos erro pro candidato se o backup funcionou.
    if (saved) return res.json({ ok: true, sheets: false });
    return res.status(502).json({ ok: false, error: 'sheets_failed' });
  }
});

// ── estatico ──
app.use(express.static(PUBLIC_DIR, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (/\.(webp|png|jpe?g|gif|svg|ico|mp4|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.use((_req, res) => res.status(404).send('Not found'));

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`rep-dinastia on :${PORT} | public=${PUBLIC_DIR} | sheets=${sheetsConfigured()}`));
}

export default app;
