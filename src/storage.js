import { emptyCard, rebuildCard } from './scheduler.js';

const DB_NAME = 'listenwrite-v3';
const DB_VERSION = 1;
const STORE = 'kv';
const STATE_KEY = 'state';
const LEGACY_KEY = 'listenwrite-v2';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
    version: 3,
    words: [],
    events: [],
    texts: [],
    dailyPlans: {},
    activities: [],
    settings: {
      newTarget: 30,
      reviewTarget: 80,
      retention: 0.9,
      speechRate: 0.92,
      todayBooks: [],
      typeBooks: [],
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
    id: `sample_${i + 1}`,
    en, zh, pos, def,
    sources: ['示例词库'],
    examples: [],
    retired: false,
    card: emptyCard(),
  }));
}

function normalizeWord(word, index) {
  return {
    id: word.id || `w_${Date.now().toString(36)}_${index}`,
    en: String(word.en || '').trim().toLowerCase(),
    zh: String(word.zh || ''),
    pos: String(word.pos || ''),
    def: String(word.def || ''),
    sources: Array.isArray(word.sources) ? [...new Set(word.sources)] : Array.isArray(word.src) ? [...new Set(word.src)] : [],
    examples: Array.isArray(word.examples) ? [...new Set(word.examples)] : Array.isArray(word.ex) ? [...new Set(word.ex)] : [],
    retired: Boolean(word.retired ?? word.ret),
    card: word.card || null,
  };
}

function normalizeEvent(event, index) {
  return {
    id: event.id || `legacy_ev_${index}`,
    wordId: event.wordId,
    date: event.date,
    ts: Number(event.ts) || Date.now(),
    mode: event.mode === 'type' ? 'type' : 'listen',
    result: event.result || event.res || 'bad',
    originalResult: event.originalResult || event.result || event.res || 'bad',
    cold: Boolean(event.cold),
    attempt: Number(event.attempt) || 1,
    source: event.source || null,
    sentence: event.sentence || null,
    editedAt: event.editedAt || null,
  };
}

export function normalizeState(input) {
  const base = defaultState();
  const state = { ...base, ...(input || {}) };
  state.settings = { ...base.settings, ...(input?.settings || input?.set || {}) };
  if (input?.set) {
    state.settings.newTarget = Number(input.set.newN ?? state.settings.newTarget);
    state.settings.reviewTarget = Number(input.set.reviewN ?? state.settings.reviewTarget);
    state.settings.speechRate = Number(input.set.rate ?? state.settings.speechRate);
    state.settings.todayBooks = Array.isArray(input.set.todayBooks) ? input.set.todayBooks : [];
    state.settings.typeBooks = Array.isArray(input.set.typeBooks) ? input.set.typeBooks : [];
  }
  state.words = (input?.words || []).map(normalizeWord).filter((w) => w.en);
  state.events = (input?.events || []).map(normalizeEvent).filter((e) => e.wordId);
  state.texts = Array.isArray(input?.texts) ? input.texts : [];
  state.activities = Array.isArray(input?.activities) ? input.activities : [];
  state.dailyPlans = {};
  for (const word of state.words) {
    const evs = state.events.filter((e) => e.wordId === word.id && e.cold).sort((a, b) => a.ts - b.ts);
    word.card = evs.length ? rebuildCard(evs, state.settings.retention) : (word.card || emptyCard());
  }
  state.version = 3;
  return state;
}

async function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadState() {
  try {
    const saved = await dbGet(STATE_KEY);
    if (saved) return normalizeState(saved);
    const legacy = await migrateLegacy();
    const state = legacy || defaultState();
    if (!state.words.length) state.words = sampleWords();
    await dbSet(STATE_KEY, state);
    return state;
  } catch {
    const legacy = await migrateLegacy();
    const state = legacy || defaultState();
    if (!state.words.length) state.words = sampleWords();
    return state;
  }
}

export async function saveState(state) {
  state.version = 3;
  try { await dbSet(STATE_KEY, state); }
  catch { localStorage.setItem('listenwrite-v3-fallback', JSON.stringify(state)); }
}

export async function replaceState(raw) {
  const state = normalizeState(raw);
  await saveState(state);
  return state;
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}
