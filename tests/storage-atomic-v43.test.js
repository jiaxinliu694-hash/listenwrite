import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

function memoryStorage() {
  return {
    data: new Map(),
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
    setItem(key, value) { this.data.set(key, String(value)); },
    removeItem(key) { this.data.delete(key); },
  };
}
async function resetDatabase() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('listenwrite-v3');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('database deletion blocked'));
  });
}

test('storage queues immutable snapshots, flushes reads, and atomically advances state plus cloud base', async () => {
  globalThis.indexedDB = indexedDB;
  globalThis.IDBKeyRange = IDBKeyRange;
  globalThis.localStorage = memoryStorage();
  await resetDatabase();

  const storage = await import(`../src/storage.js?atomic=${Date.now()}`);
  const first = storage.defaultState();
  first.texts = [{ id: 'before', title: 'before', collection: '', body: 'before', sentences: [] }];

  const queued = storage.saveState(first);
  first.texts[0].id = 'mutated-after-save-call';
  const persistedBeforeAwaitingQueued = await storage.readPersistedState();
  await queued;
  assert.equal(persistedBeforeAwaitingQueued.texts[0].id, 'before');

  const remote = storage.defaultState();
  remote.texts = [{ id: 'remote', title: 'remote', collection: '', body: 'remote', sentences: [] }];
  await storage.applySyncedState(remote);

  const [persisted, base] = await Promise.all([
    storage.readPersistedState(),
    storage.readCloudSyncBase(),
  ]);
  assert.deepEqual(persisted, base);
  assert.equal(persisted.texts[0].id, 'remote');
  assert.equal(storage.isRemoteStateApplying(), false);
});
