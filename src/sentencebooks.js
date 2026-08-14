const VALID_STATUS = new Set(['familiar', 'unfamiliar', 'unknown']);
const VALID_PRACTICE_STATUS = new Set(['unseen', 'repeat', 'done', 'ignored']);

function id(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeLexeme(value) {
  return String(value || '').trim().toLowerCase();
}

export function ensureSimpleWords(state) {
  if (!Array.isArray(state.simpleWords)) state.simpleWords = [];
  const set = new Set(state.simpleWords.map(normalizeLexeme).filter(Boolean));
  for (const word of state.words || []) {
    if (word?.retired && word.en) set.add(normalizeLexeme(word.en));
  }
  state.simpleWords = [...set];
  return state.simpleWords;
}

export function isSimpleLexeme(state, value) {
  const lexeme = normalizeLexeme(value);
  if (!lexeme) return false;
  if (ensureSimpleWords(state).includes(lexeme)) return true;
  return Boolean((state.words || []).find((word) => normalizeLexeme(word.en) === lexeme)?.retired);
}

export function markSimpleLexeme(state, value, simple = true) {
  const lexeme = normalizeLexeme(value);
  if (!lexeme) return false;
  const set = new Set(ensureSimpleWords(state));
  if (simple) set.add(lexeme);
  else set.delete(lexeme);
  state.simpleWords = [...set];
  for (const word of state.words || []) {
    if (normalizeLexeme(word.en) === lexeme) word.retired = simple;
  }
  return simple;
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

function sameSource(entry, sourceTextId, sentenceIndex, sourceSentenceId = null) {
  if (sourceSentenceId && entry.sourceSentenceId) return String(entry.sourceSentenceId) === String(sourceSentenceId);
  return String(entry.sourceTextId || '') === String(sourceTextId || '')
    && Number(entry.sentenceIndex ?? -1) === Number(sentenceIndex ?? -1);
}

export function addSentenceEntry(state, {
  bookName = '句子词库',
  text,
  tokens = [],
  sourceTextId = null,
  sourceSentenceId = null,
  sourceTitle = '',
  sourceCollection = '',
  sentenceIndex = null,
} = {}) {
  const book = ensureSentenceBook(state, bookName);
  const cleanText = String(text || '').trim();
  let entry = book.entries.find((candidate) => candidate.text === cleanText && sameSource(candidate, sourceTextId, sentenceIndex, sourceSentenceId));
  if (entry) {
    entry.updatedAt = Date.now();
    if (sourceTitle) entry.sourceTitle = String(sourceTitle);
    if (sourceCollection) entry.sourceCollection = String(sourceCollection);
    if (sourceTextId) entry.sourceTextId = sourceTextId;
    if (sourceSentenceId) entry.sourceSentenceId = sourceSentenceId;
    if (sentenceIndex != null) entry.sentenceIndex = Number(sentenceIndex);
    return { book, entry, reused: true };
  }
  entry = {
    id: id('sent'),
    text: cleanText,
    sourceTextId: sourceTextId || null,
    sourceSentenceId: sourceSentenceId || null,
    sourceTitle: String(sourceTitle || ''),
    sourceCollection: String(sourceCollection || ''),
    sentenceIndex: sentenceIndex == null ? null : Number(sentenceIndex),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastPracticedAt: 0,
    practiceStatus: 'unseen',
    wholeAttempts: [],
    tokens: tokens.map((surface, index) => ({
      id: id(`tok${index}`),
      surface: String(surface),
      normalized: normalizeLexeme(surface),
      position: index,
      status: null,
      lastInput: '',
      lastSpellingResult: null,
      attempts: [],
    })),
  };
  book.entries.unshift(entry);
  book.updatedAt = Date.now();
  return { book, entry, reused: false };
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

export function deriveSentencePracticeStatus(entry) {
  if (!entry) return 'unseen';
  if (entry.practiceStatus === 'ignored') return 'ignored';
  if (entry.practiceStatus === 'done' || entry.practiceStatus === 'repeat') return entry.practiceStatus;
  const tokens = Array.isArray(entry.tokens) ? entry.tokens : [];
  if (tokens.some((token) => token.status === 'unfamiliar' || token.status === 'unknown')) return 'repeat';
  if ((Array.isArray(entry.wholeAttempts) && entry.wholeAttempts.length) || tokens.some((token) => Array.isArray(token.attempts) && token.attempts.length)) return 'done';
  return 'unseen';
}

export function setSentencePracticeStatus(entry, status) {
  if (!entry || !VALID_PRACTICE_STATUS.has(status)) return null;
  entry.practiceStatus = status;
  entry.lastPracticedAt = Date.now();
  entry.updatedAt = Date.now();
  return entry.practiceStatus;
}

export function recordWholeSentenceAttempt(entry, { input = '', alignment = null, revealed = false } = {}) {
  if (!entry) return null;
  entry.wholeAttempts = Array.isArray(entry.wholeAttempts) ? entry.wholeAttempts : [];
  const attempt = {
    ts: Date.now(),
    input: String(input || ''),
    revealed: Boolean(revealed),
    correct: Boolean(!revealed && alignment?.correct),
    distance: Number(alignment?.distance) || 0,
    operations: Array.isArray(alignment?.operations) ? alignment.operations.map((op) => ({
      type: op.type,
      expected: op.expected || '',
      actual: op.actual || '',
      expectedIndex: Number.isInteger(op.expectedIndex) ? op.expectedIndex : null,
      actualIndex: Number.isInteger(op.actualIndex) ? op.actualIndex : null,
    })) : [],
  };
  entry.wholeAttempts.push(attempt);
  entry.practiceStatus = attempt.correct ? 'done' : 'repeat';
  entry.lastPracticedAt = attempt.ts;
  entry.updatedAt = attempt.ts;
  return attempt;
}

export function sentencePracticeIndexes(state, entry, {
  onlyProblems = false,
  unique = false,
  skipSimple = true,
  statuses = ['unfamiliar', 'unknown'],
} = {}) {
  const wanted = new Set(statuses);
  const seen = new Set();
  const out = [];
  for (let index = 0; index < (entry?.tokens || []).length; index += 1) {
    const token = entry.tokens[index];
    const key = token.normalized || normalizeLexeme(token.surface);
    if (onlyProblems && !wanted.has(token.status)) continue;
    if (skipSimple && isSimpleLexeme(state, key)) continue;
    if (unique && seen.has(key)) continue;
    seen.add(key);
    out.push(index);
  }
  return out;
}

export function sentenceProblemOccurrences(entry, statuses = ['unfamiliar', 'unknown']) {
  const wanted = new Set(statuses);
  const out = [];
  for (let tokenIndex = 0; tokenIndex < (entry?.tokens || []).length; tokenIndex += 1) {
    const token = entry.tokens[tokenIndex];
    if (!wanted.has(token.status)) continue;
    out.push({
      ...token,
      tokenIndex,
      sentence: entry.text,
      entryId: entry.id,
      sourceTextId: entry.sourceTextId || null,
      sourceTitle: entry.sourceTitle || '',
      sourceCollection: entry.sourceCollection || '',
      sentenceIndex: entry.sentenceIndex == null ? null : Number(entry.sentenceIndex),
    });
  }
  return out;
}

export function sentenceProblemTokens(entry, statuses = ['unfamiliar', 'unknown']) {
  const byWord = new Map();
  for (const token of sentenceProblemOccurrences(entry, statuses)) {
    const key = token.normalized || normalizeLexeme(token.surface);
    const current = byWord.get(key);
    if (!current) byWord.set(key, { ...token, occurrences: [token] });
    else current.occurrences.push(token);
  }
  return [...byWord.values()];
}

export function allSentenceProblemTokens(book, statuses = ['unfamiliar', 'unknown']) {
  const byWord = new Map();
  for (const entry of book?.entries || []) {
    for (const token of sentenceProblemOccurrences(entry, statuses)) {
      const key = token.normalized || normalizeLexeme(token.surface);
      const current = byWord.get(key);
      if (!current) byWord.set(key, { ...token, occurrences: [token] });
      else current.occurrences.push(token);
    }
  }
  return [...byWord.values()];
}

export function findSentenceProblemEntries(state, { bookId = '', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const rows = [];
  for (const book of ensureSentenceBooks(state)) {
    if (bookId && book.id !== bookId) continue;
    for (const entry of book.entries || []) {
      if (deriveSentencePracticeStatus(entry) === 'ignored') continue;
      const problems = sentenceProblemOccurrences(entry);
      if (!problems.length) continue;
      const haystack = [
        book.name,
        entry.text,
        entry.sourceTitle,
        entry.sourceCollection,
        entry.sentenceIndex == null ? '' : String(Number(entry.sentenceIndex) + 1),
        problems.map((token) => token.normalized || token.surface).join(' '),
      ].join(' ').toLowerCase();
      if (q && !haystack.includes(q)) continue;
      rows.push({ book, entry, problems });
    }
  }
  return rows.sort((a, b) => Number(b.entry.updatedAt || 0) - Number(a.entry.updatedAt || 0));
}

export function sentenceSourceLabel(entry) {
  const parts = [];
  if (entry?.sourceCollection) parts.push(entry.sourceCollection);
  if (entry?.sourceTitle) parts.push(entry.sourceTitle);
  if (entry?.sentenceIndex != null) parts.push(`第 ${Number(entry.sentenceIndex) + 1} 句`);
  return parts.length ? parts.join(' · ') : '手动句子';
}

function tsvCell(value) {
  return String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

export function problemTokensToTSV(tokens, { source = '句子错题本', sentence = '' } = {}) {
  const rows = ['en\tzh\tpos\tdef\tsource\texample'];
  const seen = new Set();
  for (const token of tokens) {
    const en = token.normalized || normalizeLexeme(token.surface);
    if (!en || seen.has(en)) continue;
    seen.add(en);
    rows.push([
      en,
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
      sourceTextId: entry.sourceTextId || null,
      sourceSentenceId: entry.sourceSentenceId || null,
      sourceTitle: String(entry.sourceTitle || ''),
      sourceCollection: String(entry.sourceCollection || ''),
      sentenceIndex: entry.sentenceIndex == null ? null : Number(entry.sentenceIndex),
      createdAt: Number(entry.createdAt) || Date.now(),
      updatedAt: Number(entry.updatedAt) || Date.now(),
      lastPracticedAt: Number(entry.lastPracticedAt) || 0,
      practiceStatus: VALID_PRACTICE_STATUS.has(entry.practiceStatus) ? entry.practiceStatus : 'unseen',
      wholeAttempts: Array.isArray(entry.wholeAttempts) ? entry.wholeAttempts : [],
      tokens: (Array.isArray(entry.tokens) ? entry.tokens : []).map((token, ti) => ({
        id: token.id || `tok_legacy_${bi}_${ei}_${ti}`,
        surface: String(token.surface || ''),
        normalized: normalizeLexeme(token.normalized || token.surface),
        position: Number.isFinite(Number(token.position)) ? Number(token.position) : ti,
        status: VALID_STATUS.has(token.status) ? token.status : null,
        lastInput: String(token.lastInput || ''),
        lastSpellingResult: token.lastSpellingResult === 'good' ? 'good' : token.lastSpellingResult === 'bad' ? 'bad' : null,
        attempts: Array.isArray(token.attempts) ? token.attempts : [],
      })),
    })),
  }));
}
