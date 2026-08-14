const TOKEN_RE = /(?:[$£€¥]\s*)?\d+(?::\d{1,2})?(?:[.,]\d+)?(?:%|(?:st|nd|rd|th))?|[A-Za-z]+\d+[A-Za-z0-9-]*|\d+[A-Za-z]+(?:-[A-Za-z0-9]+)*|[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ');
}

export function tokenizeEnglish(text, options = {}) {
  const words = String(text || '').match(TOKEN_RE) || [];
  const normalized = words.map((word) => word.replace(/’/g, "'").replace(/\s+/g, ' '));
  if (!options.unique) return normalized;
  const seen = new Set();
  return normalized.filter((word) => {
    const key = normalizeToken(word);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function spellingMatches(input, answer) {
  return normalizeToken(input) === normalizeToken(answer);
}
