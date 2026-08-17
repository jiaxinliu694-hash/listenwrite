import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

test('remote apply wins over stale local saves queued after it starts', async () => {
  globalThis.indexedDB = indexedDB;
  globalThis.IDBKeyRange = IDBKeyRange;
  globalThis.localStorage = {
    data: new Map(),
    getItem(k) { return this.data.has(k) ? this.data.get(k) : null; },
    setItem(k, v) { this.data.set(k, String(v)); },
    removeItem(k) { this.data.delete(k); },
  };

  const storage = await import(`../src/storage.js?race=${Date.now()}`);
  const local = storage.defaultState();
  local.texts = [{ id: 'local', title: 'local', collection: '', body: 'local', sentences: [] }];
  await storage.saveState(local);

  const remote = storage.defaultState();
  remote.texts = [{ id: 'remote', title: 'remote', collection: '', body: 'remote', sentences: [] }];
  const stale = storage.defaultState();
  stale.texts = [{ id: 'stale', title: 'stale', collection: '', body: 'stale', sentences: [] }];

  const applying = storage.applyRemoteState(remote);
  const staleSave = storage.saveState(stale);
  await Promise.all([applying, staleSave]);

  const persisted = await storage.readPersistedState();
  assert.equal(persisted.texts[0].id, 'remote');
  assert.equal(storage.isRemoteStateApplying(), true);
});
