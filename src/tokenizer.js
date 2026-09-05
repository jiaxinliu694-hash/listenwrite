const TOKEN_RE = /[A-Za-z]+\d+[A-Za-z0-9-]*|\d+[A-Za-z]+(?:-[A-Za-z0-9]+)*|(?:[$£€¥]\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?::\d{1,2}|\.\d+)?(?:%|st|nd|rd|th)?|[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

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

const SMALL = {
  zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
  ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16,
  seventeen:17, eighteen:18, nineteen:19,
};
const TENS = { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
const SCALES = { thousand:1_000, million:1_000_000, billion:1_000_000_000, trillion:1_000_000_000_000 };
const ORDINAL_CARDINAL = {
  zeroth:'zero', first:'one', second:'two', third:'three', fourth:'four', fifth:'five',
  sixth:'six', seventh:'seven', eighth:'eight', ninth:'nine', tenth:'ten', eleventh:'eleven',
  twelfth:'twelve', thirteenth:'thirteen', fourteenth:'fourteen', fifteenth:'fifteen',
  sixteenth:'sixteen', seventeenth:'seventeen', eighteenth:'eighteen', nineteenth:'nineteen',
  twentieth:'twenty', thirtieth:'thirty', fortieth:'forty', fiftieth:'fifty',
  sixtieth:'sixty', seventieth:'seventy', eightieth:'eighty', ninetieth:'ninety',
  hundredth:'hundred', thousandth:'thousand', millionth:'million', billionth:'billion',
  trillionth:'trillion',
};

function numberWordParts(text) {
  return normalizeToken(text)
    .replace(/[–—-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => part !== 'and');
}
function integerWordsToNumber(parts) {
  if (!parts.length) return null;
  let total = 0;
  let group = 0;
  let previous = 'start';
  let previousScale = Number.POSITIVE_INFINITY;
  let used = false;

  for (const part of parts) {
    if (part in SMALL) {
      const value = SMALL[part];
      if (previous === 'unit' || previous === 'teen') return null;
      if (previous === 'tens' && value >= 10) return null;
      group += value;
      previous = value < 10 ? 'unit' : 'teen';
      used = true;
    } else if (part in TENS) {
      if (previous === 'unit' || previous === 'teen' || previous === 'tens') return null;
      group += TENS[part];
      previous = 'tens';
      used = true;
    } else if (part === 'hundred') {
      if (previous === 'unit' && group > 0 && group < 10) group *= 100;
      else if (previous === 'start' || previous === 'scale') group = 100;
      else return null;
      previous = 'hundred';
      used = true;
    } else if (part in SCALES) {
      const scale = SCALES[part];
      if (scale >= previousScale) return null;
      total += (group || 1) * scale;
      group = 0;
      previous = 'scale';
      previousScale = scale;
      used = true;
    } else {
      return null;
    }
  }
  return used ? total + group : null;
}
function wordsToNumber(text) {
  const parts = numberWordParts(text);
  const point = parts.indexOf('point');
  if (point < 0) return integerWordsToNumber(parts);
  if (parts.indexOf('point', point + 1) >= 0) return null;
  const integer = point ? integerWordsToNumber(parts.slice(0, point)) : 0;
  const fractionWords = parts.slice(point + 1);
  if (integer == null || !fractionWords.length || fractionWords.some((part) => !(part in SMALL) || SMALL[part] > 9)) return null;
  return Number(`${integer}.${fractionWords.map((part) => SMALL[part]).join('')}`);
}
function ordinalValue(text) {
  const parts = numberWordParts(text);
  if (!parts.length) return null;
  const last = parts.at(-1);
  if (!(last in ORDINAL_CARDINAL)) return null;
  parts[parts.length - 1] = ORDINAL_CARDINAL[last];
  return integerWordsToNumber(parts);
}
function numericValue(text) {
  const clean = normalizeToken(text).replace(/,/g, '');
  if (/^\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
  return wordsToNumber(clean);
}
function validClock(hour, minute) {
  return Number.isInteger(hour) && Number.isInteger(minute)
    && hour >= 0 && hour <= 24 && minute >= 0 && minute < 60
    && (hour !== 24 || minute === 0);
}
function addClock(out, hour, minute) {
  if (validClock(hour, minute)) out.add(`time:${hour}:${String(minute).padStart(2, '0')}`);
}
function currencyCanonical(symbolOrCode) {
  return ({
    '£':'gbp', gbp:'gbp', pound:'gbp', pounds:'gbp',
    '$':'usd', usd:'usd', dollar:'usd', dollars:'usd',
    '€':'eur', eur:'eur', euro:'eur', euros:'eur',
    '¥':'jpy', jpy:'jpy', yen:'jpy',
  })[symbolOrCode] || null;
}

export function numericCanonicals(value) {
  const raw = normalizeToken(value).replace(/[–—]/g, '-').trim();
  const normalized = raw.replace(/,/g, '');
  const out = new Set();

  let match = normalized.match(/^([£$€¥])\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    out.add(`${currencyCanonical(match[1])}:${Number(match[2])}`);
    return [...out];
  }
  match = normalized.match(/^(.*?)\s*(pounds?|gbp|dollars?|usd|euros?|eur|yen|jpy)$/);
  if (match) {
    const amount = numericValue(match[1]);
    const currency = currencyCanonical(match[2]);
    if (amount != null && currency) out.add(`${currency}:${amount}`);
    return [...out];
  }

  match = normalized.match(/^(\d+(?:\.\d+)?)%$/);
  if (match) {
    out.add(`pct:${Number(match[1])}`);
    return [...out];
  }
  match = normalized.match(/^(.*?)\s*(?:percent|per cent)$/);
  if (match) {
    const amount = numericValue(match[1]);
    if (amount != null) out.add(`pct:${amount}`);
    return [...out];
  }

  match = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (match) {
    addClock(out, Number(match[1]), Number(match[2]));
    return [...out];
  }
  match = normalized.match(/^(\d{1,2})\.(\d{2})$/);
  if (match) addClock(out, Number(match[1]), Number(match[2]));

  match = normalized.match(/^(\d+)(?:st|nd|rd|th)$/);
  if (match) {
    out.add(`ord:${Number(match[1])}`);
    return [...out];
  }
  const ordinal = ordinalValue(normalized);
  if (ordinal != null) {
    out.add(`ord:${ordinal}`);
    return [...out];
  }

  const number = numericValue(normalized);
  if (number != null) {
    out.add(`num:${number}`);
  } else {
    const parts = numberWordParts(normalized);
    for (let index = 1; index < parts.length; index += 1) {
      const hour = integerWordsToNumber(parts.slice(0, index));
      const minute = integerWordsToNumber(parts.slice(index));
      if (hour != null && minute != null) addClock(out, hour, minute);
    }
  }
  return [...out];
}
export function numericCanonical(value) { return numericCanonicals(value)[0] || null; }

export function spellingMatches(input, answer) {
  if (normalizeToken(input) === normalizeToken(answer)) return true;
  const expected = numericCanonicals(answer);
  const actual = numericCanonicals(input);
  if (!expected.length || !actual.length) return false;
  const wanted = new Set(expected);
  return actual.some((value) => wanted.has(value));
}
