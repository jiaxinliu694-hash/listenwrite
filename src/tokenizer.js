const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

export function tokenizeEnglish(text, options = {}) {
  const words = String(text || '').match(WORD_RE) || [];
  const normalized = words.map((word) => word.replace(/’/g, "'"));
  if (!options.unique) return normalized;
  const seen = new Set();
  return normalized.filter((word) => {
    const key = word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function spellingMatches(input, answer) {
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/’/g, "'");
  return normalize(input) === normalize(answer);
}
