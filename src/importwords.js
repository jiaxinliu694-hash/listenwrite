const FIELD_ALIASES = {
  en: ['en', 'english', 'word', '单词', '英文'],
  zh: ['zh', 'chinese', 'meaning', 'translation', '中文', '释义', '中文释义'],
  pos: ['pos', 'part of speech', '词性'],
  def: ['def', 'definition', 'english definition', '英文释义'],
  source: ['source', 'book', 'wordbook', '来源', '词书'],
  example: ['example', 'sentence', '例句'],
};

function cleanCell(value) {
  return String(value ?? '').trim();
}

function delimiterScore(line, delimiter) {
  let quoted = false;
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && ch === delimiter) count += 1;
  }
  return count;
}

export function detectDelimiter(text) {
  const first = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).find((line) => line.trim()) || '';
  return delimiterScore(first, '\t') >= delimiterScore(first, ',') && delimiterScore(first, '\t') > 0 ? '\t' : ',';
}

export function parseDelimited(text, delimiter = detectDelimiter(text)) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
      continue;
    }
    if (!quoted && ch === delimiter) {
      row.push(cleanCell(cell));
      cell = '';
      continue;
    }
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cleanCell(cell));
      cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cleanCell(cell));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizedHeader(value) {
  return cleanCell(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function inferFieldMap(rows) {
  const first = rows[0] || [];
  const map = { en: 0, zh: 1, pos: 2, def: 3, source: 4, example: 5 };
  let matches = 0;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = first.findIndex((cell) => aliases.includes(normalizedHeader(cell)));
    if (index >= 0) {
      map[field] = index;
      matches += 1;
    }
  }
  return { map, hasHeader: matches > 0 };
}

export function buildImportDraft(text, fileName = '导入词库') {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  const { map, hasHeader } = inferFieldMap(rows);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const width = Math.max(0, ...rows.map((row) => row.length));
  return {
    fileName,
    sourceName: String(fileName || '').replace(/\.(csv|txt|tsv)$/i, '') || '导入词库',
    delimiter,
    rows: dataRows,
    header: hasHeader ? rows[0] : null,
    width,
    map,
  };
}

export function recordsFromDraft(draft, map = draft?.map || {}) {
  const rows = Array.isArray(draft?.rows) ? draft.rows : [];
  return rows.map((row, rowIndex) => {
    const value = (field) => {
      const index = Number(map[field]);
      return Number.isInteger(index) && index >= 0 ? cleanCell(row[index]) : '';
    };
    const en = value('en');
    return {
      rowIndex,
      en,
      zh: value('zh'),
      pos: value('pos'),
      def: value('def'),
      source: value('source') || draft.sourceName || '导入词库',
      example: value('example'),
      valid: Boolean(en),
    };
  });
}
