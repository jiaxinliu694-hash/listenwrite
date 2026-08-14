const VALID_STATUS = new Set(['familiar', 'unfamiliar', 'unknown']);

function id(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ensureSentenceBooks(state) {
  if (!Array.isArray(state.sentenceBooks)) state.sentenceBooks = [];
  return state.sentenceBooks;
}

export function ensureSentenceBook(state, name = '句子词库') {
  const books = ensureSentenceBooks(state);
  const clean = String(name || '').trim() || '句子词库';
  let book = books.find((b) => b.name === clean);
  if (!book) {
    book = { id: id('sbook'), name: clean, createdAt: Date.now(), updatedAt: Date.now(), entries: [] };
    books.push(book);
  }
  if (!Array.isArray(book.entries)) book.entries = [];
  return book;
}

export function addSentenceEntry(state, { bookName = '句子词库', text, tokens = [] }) {
  const book = ensureSentenceBook(state, bookName);
  const cleanText = String(text || '').trim();
  const entry = {
    id: id('sent'),
    text: cleanText,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tokens: tokens.map((surface, index) => ({
      id: id(`tok${index}`),
      surface: String(surface),
      normalized: String(surface).toLowerCase(),
      status: null,
      lastInput: '',
      lastSpellingResult: null,
      attempts: [],
    })),
  };
  book.entries.unshift(entry);
  book.updatedAt = Date.now();
  return { book, entry };
}

export function getSentenceEntry(state, bookId, entryId) {
  const book = ensureSentenceBooks(state).find((b) => b.id === bookId);
  const entry = book?.entries?.find((e) => e.id === entryId) || null;
  return { book: book || null, entry };
}

export function recordSentenceToken(entry, tokenIndex, { input = '', spellingResult = null, status = null } = {}) {
  const token = entry?.tokens?.[tokenIndex];
  if (!token) return null;
  token.lastInput = String(input || '');
  token.lastSpellingResult = spellingResult === 'good' ? 'good' : spellingResult === 'bad' ? 'bad' : null;
  if (status && VALID_STATUS.has(status)) token.status = status;
  token.attempts = Array.isArray(token.attempts) ? token.attempts : [];
  token.attempts.push({ ts: Date.now(), input: token.lastInput, spellingResult: token.lastSpellingResult, status: token.status });
  entry.updatedAt = Date.now();
  return token;
}

export function setSentenceTokenStatus(entry, tokenIndex, status) {
  const token = entry?.tokens?.[tokenIndex];
  if (!token || !VALID_STATUS.has(status)) return null;
  token.status = status;
  entry.updatedAt = Date.now();
  return token;
}

export function sentenceProblemTokens(entry, statuses = ['unfamiliar', 'unknown']) {
  const wanted = new Set(statuses);
  const seen = new Set();
  const out = [];
  for (const token of entry?.tokens || []) {
    if (!wanted.has(token.status)) continue;
    const key = token.normalized || token.surface.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

export function allSentenceProblemTokens(book, statuses = ['unfamiliar', 'unknown']) {
  const wanted = new Set(statuses);
  const byWord = new Map();
  for (const entry of book?.entries || []) {
    for (const token of entry.tokens || []) {
      if (!wanted.has(token.status)) continue;
      const key = token.normalized || token.surface.toLowerCase();
      if (!byWord.has(key)) byWord.set(key, { ...token, sentence: entry.text });
    }
  }
  return [...byWord.values()];
}

function tsvCell(value) {
  return String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

export function problemTokensToTSV(tokens, { source = '句子错题本', sentence = '' } = {}) {
  const rows = ['en\tzh\tpos\tdef\tsource\texample'];
  for (const token of tokens) {
    rows.push([
      token.normalized || String(token.surface).toLowerCase(),
      '', '', '',
      source,
      token.sentence || sentence || '',
    ].map(tsvCell).join('\t'));
  }
  return rows.join('\n');
}

export function normalizeSentenceBooks(value) {
  if (!Array.isArray(value)) return [];
  return value.map((book, bi) => ({
    id: book.id || `sbook_legacy_${bi}`,
    name: String(book.name || '句子词库'),
    createdAt: Number(book.createdAt) || Date.now(),
    updatedAt: Number(book.updatedAt) || Date.now(),
    entries: (Array.isArray(book.entries) ? book.entries : []).map((entry, ei) => ({
      id: entry.id || `sent_legacy_${bi}_${ei}`,
      text: String(entry.text || ''),
      createdAt: Number(entry.createdAt) || Date.now(),
      updatedAt: Number(entry.updatedAt) || Date.now(),
      tokens: (Array.isArray(entry.tokens) ? entry.tokens : []).map((token, ti) => ({
        id: token.id || `tok_legacy_${bi}_${ei}_${ti}`,
        surface: String(token.surface || ''),
        normalized: String(token.normalized || token.surface || '').toLowerCase(),
        status: VALID_STATUS.has(token.status) ? token.status : null,
        lastInput: String(token.lastInput || ''),
        lastSpellingResult: token.lastSpellingResult === 'good' ? 'good' : token.lastSpellingResult === 'bad' ? 'bad' : null,
        attempts: Array.isArray(token.attempts) ? token.attempts : [],
      })),
    })),
  }));
}
