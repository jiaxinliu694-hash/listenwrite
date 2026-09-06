import { calendarDayKey } from './studyday.js';
import { normalizeWordLexeme } from './wordtext.js';

export const PRACTICE_MODES = ['free', 'review-listen', 'review-spelling'];
export const MISTAKE_MODE_LABELS = Object.freeze({
  listen: '正式听词', type: '中文手打', free: '自由听',
  'review-listen': '错词听音复习', 'review-spelling': '错词拼写复习',
});
export const NO_BOOK = '（未归属词书）';
const uniqueStrings = values => [...new Set((Array.isArray(values) ? values : [])
  .filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean))];
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const skill = mode => mode === 'review-spelling' ? 'spelling' : mode === 'type' ? 'type' : 'listen';
const compareEvents = (a, b) => Number(a.ts) - Number(b.ts) || String(a.id).localeCompare(String(b.id));

// This log is deliberately separate from events: free listening and selected
// revision must not become a cold FSRS judgment or change today's quotas.
export function normalizePracticeEvents(value) {
  const byId = new Map();
  for (const event of Array.isArray(value) ? value : []) {
    if (!event || typeof event.id !== 'string' || !event.id || typeof event.wordId !== 'string'
      || !PRACTICE_MODES.includes(event.mode) || !['good', 'bad'].includes(event.result)
      || !Number.isFinite(Number(event.ts)) || Number(event.ts) <= 0) continue;
    const normalized = {
      ...event, ts: Number(event.ts), date: validDate(event.date) ? event.date : calendarDayKey(event.ts),
      booksSnapshot: uniqueStrings(event.booksSnapshot), studyBooks: uniqueStrings(event.studyBooks),
      enSnapshot: String(event.enSnapshot || ''), zhSnapshot: String(event.zhSnapshot || ''),
      sourceDates: uniqueStrings(event.sourceDates).filter(validDate),
    };
    const previous = byId.get(event.id);
    if (!previous || Number(normalized.editedAt || normalized.ts) >= Number(previous.editedAt || previous.ts)) byId.set(event.id, normalized);
  }
  return [...byId.values()].sort(compareEvents);
}

export function recordVocabularyPractice(state, word, mode, result, context = {}) {
  if (!word?.id || !PRACTICE_MODES.includes(mode) || !['good', 'bad'].includes(result)) throw new Error('无效的词汇练习结果');
  const ts = Number(context.ts ?? Date.now());
  if (!Number.isFinite(ts) || ts <= 0) throw new Error('无效的练习时间');
  const event = {
    id: context.id || `vp_${globalThis.crypto?.randomUUID?.() || `${ts.toString(36)}_${Math.random().toString(36).slice(2)}`}`,
    wordId: word.id, date: validDate(context.date) ? context.date : calendarDayKey(ts), ts, mode, result,
    originalResult: result, editedAt: null, sessionId: context.sessionId || null,
    booksSnapshot: uniqueStrings(word.sources), studyBooks: uniqueStrings(context.studyBooks),
    enSnapshot: String(word.en || ''), zhSnapshot: String(word.zh || ''),
    input: String(context.input || ''), sourceDates: uniqueStrings(context.sourceDates).filter(validDate),
  };
  if (!Array.isArray(state.vocabPracticeEvents)) state.vocabPracticeEvents = [];
  // Duplicate submissions of one UI judgment cannot double the error count.
  const existing = state.vocabPracticeEvents.find(item => item.id === event.id);
  if (existing) return existing;
  state.vocabPracticeEvents.push(event);
  return event;
}

export function editVocabularyPractice(state, id, result, ts = Date.now()) {
  if (!['good', 'bad'].includes(result)) return null;
  const event = (state.vocabPracticeEvents || []).find(item => item.id === id);
  if (!event || event.result === result) return event || null;
  event.result = result; event.editedAt = ts;
  return event;
}

export function buildMistakeIndex(state) {
  const words = new Map((state?.words || []).map(word => [word.id, word]));
  const seen = new Set();
  const history = [...(state?.events || []).filter(event => ['listen', 'type'].includes(event?.mode)),
    ...normalizePracticeEvents(state?.vocabPracticeEvents)].filter(event => {
    if (!event?.wordId || !['good', 'bad'].includes(event.result) || !validDate(event.date)) return false;
    const key = `${PRACTICE_MODES.includes(event.mode) ? 'practice' : 'formal'}:${event.id}`;
    if (event.id && seen.has(key)) return false;
    seen.add(key); return true;
  }).sort(compareEvents);
  const groups = new Map(), latestBySkill = new Map();
  for (const event of history) {
    latestBySkill.set(`${event.wordId}|${skill(event.mode)}`, event);
    if (event.result !== 'bad') continue;
    const key = `${event.date}|${event.wordId}`;
    if (!groups.has(key)) groups.set(key, { date: event.date, wordId: event.wordId, failures: [] });
    groups.get(key).failures.push(event);
  }
  const rows = [...groups.values()].map(group => {
    const latestEvents = Object.fromEntries(['listen', 'spelling', 'type'].map(s => [s, latestBySkill.get(`${group.wordId}|${s}`)]));
    return describeRow(group, words.get(group.wordId), latestEvents);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.lastBadTs - a.lastBadTs || a.en.localeCompare(b.en));
  return { rows, history };
}

function eventBooks(event, word) {
  const names = uniqueStrings(Array.isArray(event.booksSnapshot) ? event.booksSnapshot : word?.sources);
  return names.length ? names : [NO_BOOK];
}
function describeRow(group, word, latestEvents) {
  const lastBad = group.failures.at(-1), books = new Set(), studyBooks = new Set();
  let inferredBooks = false;
  for (const event of group.failures) {
    if (!Array.isArray(event.booksSnapshot)) inferredBooks = true;
    eventBooks(event, word).forEach(name => books.add(name));
    uniqueStrings(event.studyBooks).forEach(name => studyBooks.add(name));
  }
  const skills = [...new Set(group.failures.map(event => skill(event.mode)))];
  const latest = skills.map(s => latestEvents[s]).filter(Boolean);
  const pendingSkills = skills.filter(s => latestEvents[s]?.result !== 'good');
  return {
    ...group, key: `${group.date}|${group.wordId}`, word, latestEvents,
    en: word?.en || lastBad.enSnapshot || '（已删除词条）', zh: word?.zh || lastBad.zhSnapshot || '',
    books: [...books], studyBooks: [...studyBooks], inferredBooks,
    modes: [...new Set(group.failures.map(event => event.mode))], badCount: group.failures.length,
    lastBadTs: Number(lastBad.ts), latest: latest.sort(compareEvents).at(-1),
    resolved: pendingSkills.length === 0, pendingSkills, selectable: Boolean(word),
    answers: [...new Set(group.failures.map(event => event.input).filter(Boolean))],
  };
}

export function filterMistakeRows(rows, filters = {}) {
  const q = normalizeWordLexeme(filters.query || '');
  return rows.flatMap(original => {
    if ((filters.from && original.date < filters.from) || (filters.to && original.date > filters.to)) return [];
    const failures = original.failures.filter(event =>
      (!filters.mode || event.mode === filters.mode || (filters.mode === 'review' && event.mode.startsWith('review-')))
      && (!filters.book || eventBooks(event, original.word).includes(filters.book)));
    if (!failures.length) return [];
    const row = failures.length === original.failures.length ? original : describeRow({ date: original.date, wordId: original.wordId, failures }, original.word, original.latestEvents);
    if ((filters.status === 'pending' && row.resolved) || (filters.status === 'answered' && !row.resolved)) return [];
    if (q && !normalizeWordLexeme(row.en).includes(q) && !row.zh.toLowerCase().includes(q)) return [];
    return [row];
  });
}

export function mistakeSummary(rows) {
  const ids = new Set(rows.map(row => row.wordId));
  return { words: ids.size, errors: rows.reduce((sum, row) => sum + row.badCount, 0),
    days: new Set(rows.map(row => row.date)).size,
    pending: new Set(rows.filter(row => !row.resolved).map(row => row.wordId)).size };
}

export function groupMistakeRows(rows, by = 'date') {
  const groups = new Map();
  for (const row of rows) for (const key of by === 'book' ? row.books : [row.date]) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].map(([key, items]) => ({ key, rows: items, ...mistakeSummary(items) }))
    .sort((a, b) => by === 'date' ? b.key.localeCompare(a.key) : b.words - a.words || a.key.localeCompare(b.key));
}

export function latestMistakeDay(rows, today, beforeToday = false) {
  return rows.map(row => row.date).filter(date => beforeToday ? date < today : date <= today).sort().at(-1) || '';
}

export function selectedMistakeWords(state, selectedIds) {
  const words = new Map((state.words || []).map(word => [word.id, word]));
  return [...new Set(selectedIds)].map(id => words.get(id)).filter(Boolean);
}

export function mistakesToCSV(rows) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`; // spreadsheet formula safety
    return `"${text.replace(/"/g, '""')}"`;
  };
  const header = ['错误日期', '英文', '中文', '所属词书', '当时练习词书', '记录模式', '错误次数', '最新状态', '最近判断时间', '曾输入的错误答案', '归属依据'];
  const lines = rows.map(row => [row.date, row.en, row.zh, row.books.join('；'), row.studyBooks.join('；'),
    row.modes.map(mode => MISTAKE_MODE_LABELS[mode]).join('；'), row.badCount,
    row.resolved ? '最近已答对（不代表长期掌握）' : '最近仍错／待复习',
    row.latest?.ts ? new Date(Number(row.latest.ts)).toISOString() : '', row.answers.join('；'),
    row.inferredBooks ? '含按当前归属补充的旧记录' : '作答时快照']);
  return '\uFEFF' + [header, ...lines].map(row => row.map(cell).join(',')).join('\r\n');
}
