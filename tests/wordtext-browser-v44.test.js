import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

async function waitFor(fn) {
  for (let i = 0; i < 150; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 20)); }
  throw new Error('App did not reach expected screen');
}

test('v44 real app startup cleans local vocabulary, import previews changes and reuses the old ID', async () => {
  const dom = new JSDOM('<body><div id="app"></div><div id="toast"></div><input id="file-restore"><input id="file-import"><input id="file-text"></body>', { url: 'https://example.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.localStorage = window.localStorage; globalThis.indexedDB = new IDBFactory();
  const spoken = [];
  globalThis.speechSynthesis = window.speechSynthesis = { cancel() {}, speak(u) { spoken.push(u.text); }, getVoices() { return []; } };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
  globalThis.confirm = () => true;
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
  const storage = await import('../src/storage.js');
  // Seed the pre-fix representation directly, bypassing the repaired save API.
  const raw = { ...storage.defaultState(), words: [{ id: 'original-id', en: '&leader', zh: '领导者', pos: 'n.', sources: ['Sherry'], examples: [] }] };
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('listenwrite-v3', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      const db = req.result; const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(raw, 'state');
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error);
    };
  });
  await import('../src/app.js?wordtext-browser');
  await waitFor(() => document.querySelector('[data-nav="library"]'));
  document.querySelector('[data-nav="library"]').click();
  await waitFor(() => document.getElementById('wordSearch'));
  assert.match(document.getElementById('app').textContent, /词条杂字符修复/);
  assert.doesNotMatch(document.getElementById('wordList').textContent, /&leader/);
  assert.match(document.getElementById('wordList').textContent, /leader/);
  const input = document.getElementById('file-import');
  Object.defineProperty(input, 'files', { value: [{ name: 'cleaning.csv', text: async () => 'en,zh\n=leader,负责人\n&manager,经理\n&,不要导入' }] });
  await input.onchange();
  assert.match(document.getElementById('app').textContent, /2 行已清理 · 1 行不导入/);
  document.getElementById('confirmImportDraft').click();
  await storage.flushStateWrites();
  const saved = await storage.readPersistedState();
  assert.equal(saved.words.length, 2);
  assert.equal(saved.words.find(w => w.en === 'leader').id, 'original-id');
  assert.equal(saved.words.find(w => w.en === 'leader').zh, '领导者');
  assert.ok(saved.words.some(w => w.en === 'manager'));
  assert.equal(saved.words.some(w => /^[&=]/.test(w.en)), false);
  document.getElementById('freeListenSelect').value = 'Sherry';
  document.getElementById('startFreeListen').click();
  await waitFor(() => document.getElementById('freeBad'));
  document.getElementById('freeBad').click();
  assert.equal(document.querySelector('.word').textContent, 'leader');
  assert.equal(spoken.at(-1), 'leader');
  document.getElementById('freeBack').click();
  dom.window.close();
});
