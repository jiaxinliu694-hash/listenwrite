// Vocabulary-only text hygiene. Never apply this to a full sentence, a Chinese
// meaning, a URL or arbitrary HTML. Keep meaningful *internal* punctuation.
const ENTITIES = Object.freeze({
  amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>',
  ensp: ' ', emsp: ' ', thinsp: ' ', lrm: '', rlm: '', shy: '',
  zwnj: '', zwj: '', ndash: '–', mdash: '—', bull: '•', middot: '·',
});

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole;
    const hex = /^#x/i.test(name);
    const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : whole;
  });
}

function typography(text) {
  return text.normalize('NFC')
    .replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[‘’ʼ]/g, "'").replace(/[‐‑]/g, '-');
}

/** Return a preview without executing formulas, parsing DOM, or touching input. */
export function inspectWordText(value) {
  const original = String(value ?? '');
  let text = typography(original).trim();
  const reasons = [];
  if (text !== original.trim()) reasons.push('字符格式');
  // A bounded loop also handles pasted &amp;amp;leader. Unknown entities are
  // preserved and flagged rather than being silently changed into a new word.
  for (let i = 0; i < 4; i += 1) {
    const decoded = typography(decodeEntities(text)).trim();
    if (decoded === text) break;
    text = decoded;
    if (!reasons.includes('HTML 转义')) reasons.push('HTML 转义');
  }
  const formula = /^\s*[=+@]\s*[\p{L}_][\p{L}\p{N}_.]*\s*\(/u.test(text)
    || /^\s*=.*[!()[\]{}]/u.test(text);
  if (formula) return { original, text: original.trim(), changed: false, valid: false, reasons, issue: '疑似表格公式，请确认英文列' };

  for (let i = 0; i < 6; i += 1) {
    const before = text;
    // Excel text wrappers are data, not executable expressions.
    text = text.replace(/^=\s*"([^"\r\n]+)"$/, '$1');
    // Do not consume entities we do not know, numbers, +/-, $/£/€ or apostrophes.
    if (!/^&(?:#|[a-z][a-z0-9]*;)/i.test(text)) {
      text = text.replace(/^(?:[&=*_#•●▪‣·※†‡|!?:;，,：；。]\s*)+(?=[\p{L}\p{N}'"(])/u, '');
    }
    // List/quote markers only when separated by whitespace: -ing stays -ing.
    text = text.replace(/^(?:[-–—>»›]+\s+|\(?\d{1,4}[.)、]\s+)(?=[\p{L}])/u, '');
    const wrappers = [['"', '"'], ["'", "'"], ['“', '”'], ['(', ')'], ['[', ']'], ['【', '】']];
    for (const [left, right] of wrappers) {
      if (text.startsWith(left) && text.endsWith(right) && text.length > left.length + right.length) {
        const inner = text.slice(left.length, -right.length).trim();
        if (/[\p{L}\p{N}]/u.test(inner)) { text = inner; break; }
      }
    }
    text = text.replace(/([\p{L}\p{N}])[&=*_•●▪‣·※†‡|]+$/u, '$1').trim();
    if (text === before) break;
    if (!reasons.includes('词条边界杂字符')) reasons.push('词条边界杂字符');
  }
  text = text.replace(/ {2,}/g, ' ').trim();
  let issue = '';
  if (!text || !/[\p{L}\p{N}]/u.test(text)) issue = '空词条或只有符号';
  else if (/[\u0000-\u001F\u007F<>]/u.test(text)) issue = '包含控制字符或 HTML 标记';
  else if (/&(?:#[^;\s]*|[a-z][a-z0-9]*);/i.test(text)) issue = '未识别的 HTML 转义';
  else if (/^[&=*_#•●▪‣·※†‡|!?:;,，：；。]/u.test(text)) issue = '仍有可疑前缀';
  return { original, text, changed: text !== original, valid: !issue, reasons, issue };
}

/** Existing invalid rows are retained; new imports must check .valid first. */
export function normalizeWordLexeme(value) {
  const result = inspectWordText(value);
  return (result.valid ? result.text : String(value ?? '').trim()).toLowerCase();
}

export function hasWordTextRepairs(state) {
  return (state?.words || []).some(word => {
    const result = inspectWordText(word?.en);
    return result.valid && result.text !== String(word?.en ?? '');
  });
}

/** Pure, repeatable migration. No IDs, FSRS cards, events or plans are merged. */
export function repairWordTextState(input) {
  if (!input || !Array.isArray(input.words)) return input;
  let changed = false;
  const existing = input.wordTextRepairs;
  const journal = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  const words = input.words.map((word, index) => {
    if (!word || typeof word !== 'object') return word;
    const result = inspectWordText(word.en);
    if (!result.valid || result.text === String(word.en ?? '')) return word;
    changed = true;
    const after = result.text.toLowerCase();
    const key = `v1:${JSON.stringify([word.id ?? index, result.original, after])}`;
    journal[key] = { wordId: word.id ?? null, before: result.original, after };
    return { ...word, en: after };
  });
  if (!changed) return input;
  const simpleWords = Array.isArray(input.simpleWords)
    ? [...new Set(input.simpleWords.map(normalizeWordLexeme).filter(Boolean))] : input.simpleWords;
  return { ...input, words, ...(Array.isArray(simpleWords) ? { simpleWords } : {}), wordTextRepairs: journal };
}

export function wordTextReviewRows(state) {
  return (state?.words || []).map(word => ({ word, check: inspectWordText(word?.en) }))
    .filter(row => !row.check.valid);
}

export function wordTextDuplicateGroups(state) {
  const groups = new Map();
  for (const word of state?.words || []) {
    const key = normalizeWordLexeme(word?.en);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word?.id);
  }
  return [...groups].filter(([, ids]) => ids.length > 1).map(([en, ids]) => ({ en, ids }));
}
