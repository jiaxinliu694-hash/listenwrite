import { emptyCard, rebuildCard } from './scheduler.js';
import { calendarDayKey } from './studyday.js';
import { normalizeSentenceBooks, ensureSimpleWords, normalizeLexeme } from './sentencebooks.js';
import { normalizeTexts } from './textsentences.js';

const DB_NAME = 'listenwrite-v3';
const DB_VERSION = 1;
const STORE = 'kv';
const STATE_KEY = 'state';
const LEGACY_KEY = 'listenwrite-v2';
const FALLBACK_KEY = 'listenwrite-v3-fallback';
const STATE_VERSION = 10;

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function defaultState() {
  return {
    version: STATE_VERSION,
    words: [],
    events: [],
    texts: [],
    sentenceBooks: [],
    simpleWords: [],
    errorBooks: [],
    dailyPlans: {},
    activities: [],
    settings: {
      defaultNewTarget: 30,
      defaultReviewTarget: 80,
      retention: 0.9,
      speechRate: 0.92,
      todayBooks: [],
      typeBooks: [],
      todayPlanMode: 'mixed',
    },
  };
}

function sampleWords() {
  return [
    ['distribution', '分布；分配', 'n.', 'the way something is spread or shared'],
    ['rural', '乡村的；农村的', 'adj.', 'connected with the countryside'],
    ['decline', '下降；减少', 'n./v.', 'to become smaller, fewer or less'],
    ['agriculture', '农业', 'n.', 'the practice of farming'],
    ['significant', '显著的；重要的', 'adj.', 'large or important enough to be noticed'],
  ].map(([en, zh, pos, def], i) => ({
    id: `sample_${i + 1}`, en, zh, pos, def,
    sources: ['示例词库'], examples: [], retired: false, card: emptyCard(),
  }));
}

function normalizeWord(word, index) {
  return {
    id: word.id || `w_${Date.now().toString(36)}_${index}`,
    en: normalizeLexeme(word.en),
    zh: String(word.zh || ''),
    pos: String(word.pos || ''),
    def: String(word.def || ''),
    sources: Array.isArray(word.sources) ? [...new Set(word.sources)] : Array.isArray(word.src) ? [...new Set(word.src)] : [],
    examples: Array.isArray(word.examples) ? [...new Set(word.examples)] : Array.isArray(word.ex) ? [...new Set(word.ex)] : [],
    retired: Boolean(word.retired ?? word.ret),
    reviewHint: Boolean(word.reviewHint ?? word.priorExposure),
    needsMeaning: Boolean(word.needsMeaning) && !String(word.zh || '').trim(),
    card: word.card || null,
  };
}

function normalizeEvent(event, index, preserveDate) {
  const ts = Number(event.ts) || Date.now();
  return {
    id: event.id || `legacy_ev_${index}`,
    wordId: event.wordId,
    date: preserveDate && event.date ? event.date : calendarDayKey(ts),
    ts,
    mode: event.mode === 'type' ? 'type' : 'listen',
    result: event.result || event.res || 'bad',
    originalResult: event.originalResult || event.result || event.res || 'bad',
    cold: false,
    attempt: 1,
    source: event.source || null,
    sentence: event.sentence || null,
    editedAt: event.editedAt || null,
  };
}

function normalizeSegment(segment, index) {
  return {
    id: segment.id || `seg_${index}`,
    book: String(segment.book || ''),
    newTarget: Math.max(0, Number(segment.newTarget) || 0),
    reviewTarget: Math.max(0, Number(segment.reviewTarget) || 0),
    newIds: Array.isArray(segment.newIds) ? segment.newIds : [],
    reviewIds: Array.isArray(segment.reviewIds) ? segment.reviewIds : [],
  };
}

function normalizePlan(plan, key) {
  const segments = Array.isArray(plan.bookSegments) ? plan.bookSegments.map(normalizeSegment) : [];
  return {
    date: plan.date || key,
    mode: plan.mode === 'sequential' ? 'sequential' : 'mixed',
    books: Array.isArray(plan.books) ? plan.books : [],
    newTarget: Math.max(0, Number(plan.newTarget) || 0),
    reviewTarget: Math.max(0, Number(plan.reviewTarget) || 0),
    newIds: Array.isArray(plan.newIds) ? plan.newIds : [],
    reviewIds: Array.isArray(plan.reviewIds) ? plan.reviewIds : [],
    bookSegments: segments,
    resumeWordId: plan.resumeWordId || null,
    drawNonce: Math.max(0, Number(plan.drawNonce) || 0),
    createdAt: Number(plan.createdAt) || Date.now(),
    updatedAt: Number(plan.updatedAt) || Date.now(),
  };
}

function reindexEvents(events) {
  const firstListenByWordDay = new Set();
  const attempts = new Map();
  events.sort((a, b) => a.ts - b.ts);
  for (const e of events) {
    const dayKey = `${e.wordId}|${e.date}`;
    if (e.mode === 'listen') {
      e.cold = !firstListenByWordDay.has(dayKey);
      firstListenByWordDay.add(dayKey);
    } else {
      e.cold = false;
    }
    const attemptKey = `${dayKey}|${e.mode}`;
    const n = (attempts.get(attemptKey) || 0) + 1;
    attempts.set(attemptKey, n);
    e.attempt = n;
  }
  return events;
}

function normalizeActivities(list, preserveDate) {
  return (Array.isArray(list) ? list : []).map((a) => ({
    ...a,
    date: preserveDate && a.date ? a.date : calendarDayKey(Number(a.start) || Number(a.lastTouch) || Date.now()),
  }));
}

export function normalizeState(input) {
  const base = defaultState();
  const inputVersion = Number(input?.version) || 0;
  const migrateScheduling = inputVersion < STATE_VERSION;
  const oldSettings = input?.settings || input?.set || {};
  const state = { ...base, ...(input || {}) };
  const oldNew = Number(oldSettings.defaultNewTarget ?? oldSettings.newTarget ?? oldSettings.newN ?? base.settings.defaultNewTarget);
  const oldReview = Number(oldSettings.defaultReviewTarget ?? oldSettings.reviewTarget ?? oldSettings.reviewN ?? base.settings.defaultReviewTarget);
  state.settings = {
    ...base.settings,
    ...oldSettings,
    defaultNewTarget: Math.max(0, oldNew || 0),
    defaultReviewTarget: Math.max(0, oldReview || 0),
    todayPlanMode: oldSettings.todayPlanMode === 'sequential' ? 'sequential' : 'mixed',
  };
  if (input?.set) {
    state.settings.speechRate = Number(input.set.rate ?? state.settings.speechRate);
    state.settings.todayBooks = Array.isArray(input.set.todayBooks) ? input.set.todayBooks : [];
    state.settings.typeBooks = Array.isArray(input.set.typeBooks) ? input.set.typeBooks : [];
  }
  delete state.settings.newTarget;
  delete state.settings.reviewTarget;
  delete state.settings.newN;
  delete state.settings.reviewN;
  delete state.settings.rate;
  state.settings.retention = Math.min(.97, Math.max(.75, Number(state.settings.retention) || .9));

  const preserveDates = inputVersion >= 4;
  state.words = (input?.words || []).map(normalizeWord).filter((w) => w.en);
  state.events = reindexEvents((input?.events || []).map((e, i) => normalizeEvent(e, i, preserveDates)).filter((e) => e.wordId));
  state.texts = normalizeTexts(input?.texts);
  state.sentenceBooks = normalizeSentenceBooks(input?.sentenceBooks);
  state.simpleWords = Array.isArray(input?.simpleWords) ? [...new Set(input.simpleWords.map(normalizeLexeme).filter(Boolean))] : [];
  ensureSimpleWords(state);
  const inferredErrorBooks = new Set(Array.isArray(input?.errorBooks) ? input.errorBooks.map(String).filter(Boolean) : []);
  for (const word of state.words) for (const source of word.sources || []) if (/错题|错词|error/i.test(source)) inferredErrorBooks.add(source);
  state.errorBooks = [...inferredErrorBooks];
  state.activities = normalizeActivities(input?.activities, preserveDates);
  state.dailyPlans = {};
  if (inputVersion >= 4 && input?.dailyPlans && typeof input.dailyPlans === 'object' && !Array.isArray(input.dailyPlans)) {
    for (const [key, plan] of Object.entries(input.dailyPlans)) state.dailyPlans[key] = normalizePlan(plan, key);
  }
  for (const word of state.words) {
    if (state.simpleWords.includes(word.en)) word.retired = true;
    const evs = state.events.filter((e) => e.wordId === word.id && e.cold && e.mode === 'listen').sort((a, b) => a.ts - b.ts);
    if (migrateScheduling) {
      word.card = evs.length ? rebuildCard(evs, state.settings.retention) : emptyCard();
    } else if (!word.card) {
      word.card = evs.length ? rebuildCard(evs, state.settings.retention) : emptyCard();
    }
  }
  state.version = STATE_VERSION;
  return state;
}

async function parseLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function loadState() {
  try {
    const saved = await dbGet(STATE_KEY);
    if (saved) return normalizeState(saved);
    const fallback = await parseLocal(FALLBACK_KEY);
    if (fallback) { await dbSet(STATE_KEY, fallback); return fallback; }
    const legacy = await parseLocal(LEGACY_KEY);
    const state = legacy || defaultState();
    if (!state.words.length) state.words = sampleWords();
    await dbSet(STATE_KEY, state);
    return normalizeState(state);
  } catch {
    const fallback = await parseLocal(FALLBACK_KEY);
    if (fallback) return fallback;
    const legacy = await parseLocal(LEGACY_KEY);
    const state = legacy || defaultState();
    if (!state.words.length) state.words = sampleWords();
    return normalizeState(state);
  }
}

export async function saveState(state) {
  state.version = STATE_VERSION;
  ensureSimpleWords(state);
  try {
    await dbSet(STATE_KEY, state);
    localStorage.removeItem(FALLBACK_KEY);
  } catch {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  }
}

export async function replaceState(raw) {
  const state = normalizeState(raw);
  await saveState(state);
  return state;
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}
