import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

function memoryStorage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}
async function connect(factory) {
  return new Promise((resolve, reject) => {
    const req = factory.open('listenwrite-v3', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function put(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
  });
}
async function get(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}

test('v44 first open atomically backs up local dirty data, repairs it, and a reload does not repeat repair', async () => {
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage = memoryStorage();
  const storage = await import('../src/storage.js?wordtext-persist');
  const raw = storage.normalizeState({ ...storage.defaultState(),
    words: [{ id: 'w-leader', en: 'leader', zh: '领导者', pos: 'n.', sources: ['Sherry'], examples: ['Our leader spoke.'], card: { reps: 9, due: 123, stability: 4 } }],
    events: [{ id: 'e1', wordId: 'w-leader', mode: 'listen', result: 'bad', ts: 1780000000000, date: '2026-05-29' }],
    dailyPlans: { '2026-05-29': { date: '2026-05-29', newIds: ['w-leader'], reviewIds: [], createdAt: 1, updatedAt: 1, resumeWordId: 'w-leader' } },
  });
  raw.words[0].en = '&leader';
  const db = await connect(indexedDB);
  await put(db, 'state', raw);
  await put(db, 'cloud-base-v1', raw);
  const fixed = await storage.loadState();
  assert.equal(fixed.words[0].en, 'leader');
  assert.equal(fixed.words[0].id, 'w-leader');
  assert.deepEqual(fixed.events, raw.events);
  assert.deepEqual(fixed.dailyPlans, raw.dailyPlans);
  assert.deepEqual(fixed.words[0].card, raw.words[0].card);
  assert.deepEqual(await get(db, 'word-text-backup-v1'), raw);
  assert.equal((await get(db, 'state')).words[0].en, 'leader');
  assert.deepEqual(await get(db, 'cloud-base-v1'), raw, 'do not pretend new data has already synchronized');
  const again = await storage.loadState();
  assert.deepEqual(again.wordTextRepairs, fixed.wordTextRepairs);
  assert.deepEqual(await get(db, 'word-text-backup-v1'), raw);
  db.close();
});

test('v44 cloud application and backup import use the same repair without deleting events', async () => {
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage = memoryStorage();
  const storage = await import('../src/storage.js?wordtext-cloud');
  const raw = { ...storage.defaultState(), words: [{ id: 'w', en: '=manager', zh: '经理', sources: [], card: { reps: 0, due: 0 } }],
    events: [{ id: 'e', wordId: 'w', mode: 'listen', result: 'good', ts: 1780000000000, date: '2026-05-29' }] };
  const fixed = await storage.applySyncedState(raw);
  assert.equal(fixed.words[0].en, 'manager');
  assert.equal(fixed.events.length, 1);
  assert.equal(fixed.events[0].wordId, 'w');
  assert.deepEqual(await storage.readPersistedState(), await storage.readCloudSyncBase());
  const imported = await storage.replaceState(raw);
  assert.equal(imported.words[0].en, 'manager');
  assert.equal(Object.values(imported.wordTextRepairs)[0].before, '=manager');
});

test('v44 fallback storage recovers dirty local words even when IndexedDB is unavailable', async () => {
  globalThis.indexedDB = { open() { throw new Error('IDB unavailable'); } };
  globalThis.localStorage = memoryStorage();
  const storage = await import('../src/storage.js?wordtext-fallback');
  const raw = { ...storage.defaultState(), words: [{ id: 'offline', en: '&leader', zh: '领导者', sources: [] }], events: [] };
  localStorage.setItem('listenwrite-v3-fallback', JSON.stringify(raw));
  const fixed = await storage.loadState();
  assert.equal(fixed.words[0].en, 'leader');
  assert.equal(fixed.words[0].id, 'offline');
  await storage.saveState(fixed);
  const saved = JSON.parse(localStorage.getItem('listenwrite-v3-fallback'));
  assert.equal(saved.words[0].en, 'leader');
  assert.equal(Object.values(saved.wordTextRepairs)[0].before, '&leader');
});
