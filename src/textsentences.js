import { tokenizeEnglish } from './tokenizer.js';

function id(prefix = 'sentence') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function cleanSegment(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function fallbackSegments(input) {
  const protectedDots = new Map();
  let serial = 0;
  const protect = (match) => {
    const key = `__ABBR_${serial++}__`;
    protectedDots.set(key, match);
    return key;
  };
  let safe = input.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)\./gi, protect);
  safe = safe.replace(/\b(?:e\.g\.|i\.e\.|U\.S\.|U\.K\.)/gi, protect);
  const chunks = safe.match(/[^.!?。！？\n]+[.!?。！？]+|[^.!?。！？\n]+(?=\n|$)/g) || [];
  return chunks.map((chunk) => {
    let restored = chunk;
    for (const [key, value] of protectedDots) restored = restored.replaceAll(key, value);
    return cleanSegment(restored);
  }).filter(Boolean);
}

function mergeTitleAbbreviationSegments(rows) {
  const out = [];
  const titleOnly = /^(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St)\.$/i;
  for (const row of rows) {
    const previous = out[out.length - 1];
    if (previous && titleOnly.test(previous.text)) {
      previous.text = cleanSegment(`${previous.text} ${row.text}`);
      previous.end = row.end;
      continue;
    }
    out.push({ ...row });
  }
  return out;
}

export function segmentTextSentences(body, locale = 'en') {
  const input = String(body || '').replace(/\r/g, '');
  if (!input.trim()) return [];
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
      const rows = [];
      for (const part of segmenter.segment(input)) {
        const text = cleanSegment(part.segment);
        if (text) rows.push({ text, start: Number(part.index) || 0, end: (Number(part.index) || 0) + String(part.segment || '').length });
      }
      const merged = mergeTitleAbbreviationSegments(rows);
      if (merged.length) return merged;
    } catch {}
  }
  return fallbackSegments(input).map((text, index) => ({ text, start: index, end: index + text.length }));
}

function sentenceKey(value) {
  return cleanSegment(value).toLowerCase();
}

export function reconcileTextSentences(text) {
  if (!text || typeof text !== 'object') return [];
  const old = Array.isArray(text.sentences) ? text.sentences : [];
  const oldIndex = Math.max(0, Number(text.sentence) || 0);
  const oldCurrentId = text.currentSentenceId || old[oldIndex]?.id || null;
  const buckets = new Map();
  for (const row of old) {
    const key = sentenceKey(row?.text);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const now = Date.now();
  const next = segmentTextSentences(text.body).map((segment, index) => {
    const key = sentenceKey(segment.text);
    const reused = buckets.get(key)?.shift() || null;
    return {
      ...(reused || {}),
      id: reused?.id || id('tsent'),
      text: segment.text,
      index,
      start: segment.start,
      end: segment.end,
      createdAt: Number(reused?.createdAt) || now,
      updatedAt: reused?.text === segment.text ? (Number(reused?.updatedAt) || now) : now,
    };
  });
  text.sentences = next;
  let currentIndex = oldCurrentId ? next.findIndex((row) => row.id === oldCurrentId) : -1;
  if (currentIndex < 0) currentIndex = Math.min(oldIndex, Math.max(0, next.length - 1));
  text.sentence = next.length ? currentIndex : 0;
  text.currentSentenceId = next[currentIndex]?.id || null;
  return next;
}

export function normalizeTexts(value) {
  return (Array.isArray(value) ? value : []).map((text, index) => {
    const normalized = {
      id: text?.id || `text_legacy_${index}`,
      title: String(text?.title || '未命名文本'),
      collection: String(text?.collection || '未分类'),
      body: String(text?.body || ''),
      createdAt: Number(text?.createdAt) || Date.now(),
      updatedAt: Number(text?.updatedAt) || Date.now(),
      lastOpened: Number(text?.lastOpened) || 0,
      sentence: Math.max(0, Number(text?.sentence) || 0),
      currentSentenceId: text?.currentSentenceId || null,
      hidden: Boolean(text?.hidden),
      loop: Boolean(text?.loop),
      sentences: Array.isArray(text?.sentences) ? text.sentences : [],
    };
    reconcileTextSentences(normalized);
    return normalized;
  });
}

function normalizedWords(value) {
  return tokenizeEnglish(value).map((word) => word.toLowerCase().replace(/’/g, "'"));
}

export function alignSentenceInput(expectedText, actualText) {
  const expected = tokenizeEnglish(expectedText);
  const actual = tokenizeEnglish(actualText);
  const a = expected.map((word) => word.toLowerCase().replace(/’/g, "'"));
  const b = actual.map((word) => word.toLowerCase().replace(/’/g, "'"));
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const replace = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const missing = dp[i - 1][j] + 1;
      const extra = dp[i][j - 1] + 1;
      dp[i][j] = Math.min(replace, missing, extra);
    }
  }
  const operations = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      operations.push({ type: 'equal', expected: expected[i - 1], actual: actual[j - 1], expectedIndex: i - 1, actualIndex: j - 1 });
      i -= 1; j -= 1; continue;
    }
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      operations.push({ type: 'replace', expected: expected[i - 1], actual: actual[j - 1], expectedIndex: i - 1, actualIndex: j - 1 });
      i -= 1; j -= 1; continue;
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      operations.push({ type: 'missing', expected: expected[i - 1], actual: '', expectedIndex: i - 1, actualIndex: null });
      i -= 1; continue;
    }
    operations.push({ type: 'extra', expected: '', actual: actual[j - 1], expectedIndex: null, actualIndex: j - 1 });
    j -= 1;
  }
  operations.reverse();
  const correct = operations.length === expected.length && operations.every((op) => op.type === 'equal');
  const wrongExpectedIndexes = [...new Set(operations.filter((op) => op.type === 'replace' || op.type === 'missing').map((op) => op.expectedIndex).filter(Number.isInteger))];
  return {
    expected,
    actual,
    normalizedExpected: normalizedWords(expectedText),
    normalizedActual: normalizedWords(actualText),
    operations,
    distance: dp[a.length][b.length],
    correct,
    wrongExpectedIndexes,
  };
}
