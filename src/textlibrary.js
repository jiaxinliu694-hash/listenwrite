import { isSimpleLexeme, normalizeLexeme } from './sentencebooks.js';

function tokenAttemptTime(token) {
  return Math.max(0, ...(Array.isArray(token?.attempts) ? token.attempts : []).map((attempt) => Number(attempt?.ts) || 0));
}

export function sentenceEntryPracticeTime(entry) {
  const whole = Math.max(0, ...(Array.isArray(entry?.wholeAttempts) ? entry.wholeAttempts : []).map((attempt) => Number(attempt?.ts) || 0));
  const split = Math.max(0, ...(Array.isArray(entry?.tokens) ? entry.tokens : []).map(tokenAttemptTime));
  return Math.max(Number(entry?.lastPracticedAt) || 0, whole, split);
}

export function isSentenceEntryPracticed(entry) {
  if (!entry) return false;
  if (sentenceEntryPracticeTime(entry) > 0) return true;
  return (entry.tokens || []).some((token) => token?.status === 'familiar' || token?.status === 'unfamiliar' || token?.status === 'unknown');
}

export function linkedTextEntries(state, textId, { practicedOnly = false } = {}) {
  const rows = [];
  for (const book of state?.sentenceBooks || []) {
    for (const entry of book?.entries || []) {
      if (String(entry?.sourceTextId || '') !== String(textId || '')) continue;
      if (practicedOnly && !isSentenceEntryPracticed(entry)) continue;
      rows.push({ book, entry, practicedAt: sentenceEntryPracticeTime(entry) });
    }
  }
  return rows.sort((a, b) => (Number(a.entry?.sentenceIndex ?? 1e9) - Number(b.entry?.sentenceIndex ?? 1e9)) || (b.practicedAt - a.practicedAt));
}

export function textPracticeWords(state, textId) {
  const byLexeme = new Map();
  for (const { book, entry, practicedAt } of linkedTextEntries(state, textId)) {
    for (let tokenIndex = 0; tokenIndex < (entry.tokens || []).length; tokenIndex += 1) {
      const token = entry.tokens[tokenIndex];
      const attempts = Array.isArray(token?.attempts) ? token.attempts : [];
      const hasPractice = attempts.length > 0 || token?.status === 'familiar' || token?.status === 'unfamiliar' || token?.status === 'unknown';
      if (!hasPractice) continue;
      const lexeme = normalizeLexeme(token?.normalized || token?.surface);
      if (!lexeme) continue;
      const row = byLexeme.get(lexeme) || {
        lexeme,
        surface: String(token?.surface || lexeme),
        familiar: false,
        unfamiliar: false,
        simple: false,
        lastPracticedAt: 0,
        occurrences: [],
      };
      row.familiar ||= token?.status === 'familiar';
      row.unfamiliar ||= token?.status === 'unfamiliar' || token?.status === 'unknown';
      row.simple = isSimpleLexeme(state, lexeme);
      row.lastPracticedAt = Math.max(row.lastPracticedAt, tokenAttemptTime(token), practicedAt);
      row.occurrences.push({ bookId: book.id, entryId: entry.id, tokenIndex, sentenceIndex: entry.sentenceIndex, sentence: entry.text });
      byLexeme.set(lexeme, row);
    }
  }
  return [...byLexeme.values()]
    .map((row) => ({ ...row, status: row.simple ? 'simple' : row.unfamiliar ? 'unfamiliar' : row.familiar ? 'familiar' : 'heard' }))
    .sort((a, b) => (a.status === 'unfamiliar' ? -1 : 0) - (b.status === 'unfamiliar' ? -1 : 0) || b.lastPracticedAt - a.lastPracticedAt || a.lexeme.localeCompare(b.lexeme));
}

export function textUnfamiliarTokens(state, textId) {
  return textPracticeWords(state, textId)
    .filter((word) => word.unfamiliar && !word.simple)
    .map((word) => ({
      surface: word.surface,
      normalized: word.lexeme,
      sentence: word.occurrences.find((occurrence) => occurrence.sentence)?.sentence || '',
      sourceTextId: textId,
      occurrences: word.occurrences.map((occurrence) => ({ ...occurrence })),
    }));
}

export function textCollectionUnfamiliarTokens(state, collection) {
  const name = String(collection || '未分类').trim() || '未分类';
  const byLexeme = new Map();
  for (const text of state?.texts || []) {
    if ((String(text?.collection || '未分类').trim() || '未分类') !== name) continue;
    for (const token of textUnfamiliarTokens(state, text.id)) {
      const key = normalizeLexeme(token.normalized || token.surface);
      if (!key) continue;
      const current = byLexeme.get(key);
      if (!current) {
        byLexeme.set(key, {
          ...token,
          normalized: key,
          sourceTextIds: [text.id],
          occurrences: (token.occurrences || []).map((occurrence) => ({ ...occurrence })),
        });
        continue;
      }
      if (!current.sourceTextIds.includes(text.id)) current.sourceTextIds.push(text.id);
      current.occurrences.push(...(token.occurrences || []).map((occurrence) => ({ ...occurrence })));
      if (!current.sentence && token.sentence) current.sentence = token.sentence;
    }
  }
  return [...byLexeme.values()].sort((a, b) => a.normalized.localeCompare(b.normalized));
}

export function textCollectionSummaries(state) {
  const groups = new Map();
  for (const text of state?.texts || []) {
    const name = String(text?.collection || '未分类').trim() || '未分类';
    const group = groups.get(name) || { name, texts: [], textCount: 0, sentenceCount: 0, practicedSentenceCount: 0, wordCount: 0, weakCount: 0, simpleCount: 0, lastActivity: 0 };
    group.texts.push(text);
    group.textCount += 1;
    group.sentenceCount += Array.isArray(text?.sentences) && text.sentences.length ? text.sentences.length : 0;
    group.lastActivity = Math.max(group.lastActivity, Number(text?.lastOpened) || 0, Number(text?.updatedAt) || 0);
    groups.set(name, group);
  }

  for (const group of groups.values()) {
    const sentenceIds = new Set();
    const words = new Map();
    for (const text of group.texts) {
      for (const row of linkedTextEntries(state, text.id, { practicedOnly: true })) {
        sentenceIds.add(`${row.book.id}|${row.entry.id}`);
        group.lastActivity = Math.max(group.lastActivity, row.practicedAt);
      }
      for (const word of textPracticeWords(state, text.id)) {
        const current = words.get(word.lexeme);
        if (!current) words.set(word.lexeme, word);
        else words.set(word.lexeme, {
          ...current,
          simple: current.simple || word.simple,
          unfamiliar: current.unfamiliar || word.unfamiliar,
          status: (current.simple || word.simple) ? 'simple' : (current.unfamiliar || word.unfamiliar) ? 'unfamiliar' : 'familiar',
        });
      }
    }
    group.practicedSentenceCount = sentenceIds.size;
    group.wordCount = words.size;
    group.weakCount = [...words.values()].filter((word) => !word.simple && word.unfamiliar).length;
    group.simpleCount = [...words.values()].filter((word) => word.simple).length;
    group.texts.sort((a, b) => (Number(b.lastOpened || b.updatedAt || 0) - Number(a.lastOpened || a.updatedAt || 0)) || String(a.title || '').localeCompare(String(b.title || '')));
  }

  return [...groups.values()].sort((a, b) => b.lastActivity - a.lastActivity || a.name.localeCompare(b.name));
}
