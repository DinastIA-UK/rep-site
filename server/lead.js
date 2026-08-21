// Regras puras do lead: quais campos existem, o que e obrigatorio e como vira linha da planilha.

export const REQUIRED = [
  'nome', 'email', 'whatsapp', 'cidade',
  'experiencia', 'tech', 'modelo', 'disponibilidade',
  'carteira_ativa', 'motivacao',
];

// Obrigatorios somente quando carteira_ativa === 'sim' (mesma regra do front).
export const REQUIRED_CARTEIRA = ['carteira_qtd', 'carteira_fat', 'carteira_seg', 'carteira_reg'];

export const OPTIONAL = ['linkedin', 'curriculo'];

export const TRACKING = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'referrer', 'page_url',
];

// Ordem das colunas na planilha (linha 1 = cabecalho gerado automaticamente).
export const COLUMNS = [
  'data_hora',
  ...REQUIRED.slice(0, 4),          // nome email whatsapp cidade
  ...REQUIRED.slice(4, 8),          // experiencia tech modelo disponibilidade
  'carteira_ativa',
  ...REQUIRED_CARTEIRA,
  'motivacao',
  ...OPTIONAL,
  'carteira_ok',
  ...TRACKING,
  'user_agent',
  'ip',
];

// Rotulos legiveis do cabecalho (linha 1 da planilha). Chave = COLUMNS.
export const HEADER_LABELS = {
  data_hora: 'Data/Hora', nome: 'Nome', email: 'E-mail', whatsapp: 'WhatsApp', cidade: 'Cidade/UF',
  experiencia: 'Experiência em vendas', tech: 'Vende tecnologia?', modelo: 'Modelo preferido',
  disponibilidade: 'Disponibilidade', carteira_ativa: 'Carteira ativa?', carteira_qtd: 'Empresas na carteira',
  carteira_fat: 'Faturamento médio', carteira_seg: 'Segmento principal', carteira_reg: 'Região de atuação',
  motivacao: 'O que chamou atenção', linkedin: 'LinkedIn', curriculo: 'Currículo', carteira_ok: 'Aceitou compromisso',
  utm_source: 'UTM Source', utm_medium: 'UTM Medium', utm_campaign: 'UTM Campaign', utm_content: 'UTM Content',
  utm_term: 'UTM Term', referrer: 'Referrer', page_url: 'URL da página', user_agent: 'User-Agent', ip: 'IP',
};
export const HEADER_ROW = COLUMNS.map((c) => HEADER_LABELS[c] ?? c);

// Texto das opcoes dos selects (espelho do index.html) — a planilha recebe o texto, nao o codigo.
export const VALUE_LABELS = {
  experiencia: {
    "menos1": "Menos de 1 ano",
    "1a3": "1 a 3 anos",
    "3a5": "3 a 5 anos",
    "mais5": "Mais de 5 anos"
  },
  tech: {
    "sim_freq": "Sim, com frequência",
    "sim_pont": "Sim, pontualmente",
    "nao_int": "Não, mas tenho interesse",
    "nao": "Não"
  },
  modelo: {
    "presencial": "Presencial",
    "hibrido": "Híbrido",
    "remoto": "Remoto",
    "desempregado": "Não estou trabalhando"
  },
  disponibilidade: {
    "menos10": "Menos de 10h/semana",
    "10a20": "10 a 20h/semana",
    "20a30": "20 a 30h/semana",
    "integral": "30h+ por semana"
  },
  carteira_ativa: {
    "sim": "Sim",
    "nao": "Não"
  },
  carteira_qtd: {
    "1a5": "1 a 5",
    "6a15": "6 a 15",
    "16a30": "16 a 30",
    "mais30": "Mais de 30"
  },
  carteira_fat: {
    "ate1mi": "Até R$1 mi/ano",
    "1a5mi": "R$1–5 mi/ano",
    "5a20mi": "R$5–20 mi/ano",
    "mais20mi": "+R$20 mi/ano"
  }
};

// Largura das colunas em px (default 150).
export const COLUMN_WIDTHS = { data_hora: 160, nome: 220, email: 240, whatsapp: 140, cidade: 160, motivacao: 420, linkedin: 220, curriculo: 220, page_url: 260, user_agent: 200 };

const MAX_LEN = { motivacao: 4000 };
const DEFAULT_MAX = 500;

function clean(value, key) {
  if (value === undefined || value === null) return '';
  const s = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s.slice(0, MAX_LEN[key] ?? DEFAULT_MAX);
}

export function validateLead(body = {}) {
  const errors = [];
  for (const k of REQUIRED) if (!clean(body[k], k)) errors.push(k);
  if (clean(body.carteira_ativa) === 'sim') {
    for (const k of REQUIRED_CARTEIRA) if (!clean(body[k], k)) errors.push(k);
  }
  const email = clean(body.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email');
  const ok = body.carteira_ok;
  if (!(ok === true || ok === 'true' || ok === 'on' || ok === 1 || ok === '1')) errors.push('carteira_ok');
  return errors;
}

export function normalizeLead(body = {}, meta = {}) {
  const now = meta.now ?? new Date();
  const lead = {
    data_hora: now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }).replace(',', ''),
  };
  for (const k of [...REQUIRED, ...REQUIRED_CARTEIRA, ...OPTIONAL, ...TRACKING]) lead[k] = clean(body[k], k);
  if (lead.carteira_ativa !== 'sim') for (const k of REQUIRED_CARTEIRA) lead[k] = '';
  lead.carteira_ok = validateLead(body).includes('carteira_ok') ? 'nao' : 'sim';
  lead.user_agent = clean(meta.userAgent);
  lead.ip = clean(meta.ip);
  return lead;
}

export function leadToRow(lead) {
  return COLUMNS.map((c) => {
    const v = lead[c] ?? '';
    return VALUE_LABELS[c]?.[v] ?? v;
  });
}
