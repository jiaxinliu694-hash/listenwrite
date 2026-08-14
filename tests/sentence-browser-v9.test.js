import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

function waitFor(check, timeout = 3000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try { if (check()) return resolve(); } catch {}
      if (Date.now() - start > timeout) return reject(new Error('Timed out waiting for app render'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test('text reader offers true whole sentence dictation and token-level feedback', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="app"></div><div id="toast"></div>
    <input id="file-restore" type="file"><input id="file-import" type="file"><input id="file-text" type="file">
  </body>`, { url: 'https://sentence-v9.test/' });
  const { window } = dom;
  const speechSynthesis = { cancel() {}, speak(utterance) { queueMicrotask(() => utterance.onend?.()); } };
  class SpeechSynthesisUtterance { constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.onend = null; } }
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.indexedDB = indexedDB;
  globalThis.IDBKeyRange = IDBKeyRange;
  globalThis.speechSynthesis = speechSynthesis;
  globalThis.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
  globalThis.confirm = () => true;
  globalThis.prompt = (_message, value) => value || '测试错题本';
  window.speechSynthesis = speechSynthesis;
  window.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
  window.getSelection = () => ({ toString: () => '' });
  if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:test';
  if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {};

  await import(`../src/app.js?v9=${Date.now()}`);
  await waitFor(() => document.querySelector('[data-nav="text"]'));
  document.querySelector('[data-nav="text"]').click();
  await waitFor(() => document.querySelector('#newText'));
  document.getElementById('newText').click();
  await waitFor(() => document.querySelector('#textTitle'));
  document.getElementById('textTitle').value = 'Whole sentence test';
  document.getElementById('textCollection').value = '测试文本';
  document.getElementById('textBody').value = 'The rural area is quiet. Another sentence follows.';
  document.getElementById('saveText').click();
  await waitFor(() => document.querySelector('[data-open-text]'));
  document.querySelector('[data-open-text]').click();
  await waitFor(() => document.querySelector('#dictateWholeSentence'));
  assert.ok(document.querySelector('#dictateSentence'));
  assert.match(document.getElementById('app').textContent, /第 1\/2 句/);

  document.getElementById('dictateWholeSentence').click();
  await waitFor(() => document.querySelector('#wholeSentenceAnswer'));
  document.getElementById('wholeSentenceAnswer').value = 'The rural area quiet';
  document.getElementById('wholeSubmit').click();
  await waitFor(() => document.querySelector('#wholeRetry'));
  const feedback = document.getElementById('app').textContent;
  assert.match(feedback, /需重练/);
  assert.match(feedback, /is（漏）|is \(漏\)|is（漏）/);
  assert.ok(document.querySelector('#wholeRedoSplit'));
  assert.ok(document.querySelector('#wholeProblems'));

  document.getElementById('wholeFinish').click();
  await waitFor(() => document.querySelector('#dictateWholeSentence'));
  document.getElementById('textBack').click();
  await waitFor(() => document.querySelector('.sentence-library'));
  assert.match(document.querySelector('.sentence-library').textContent, /Whole sentence test|第 1 句/);
  assert.match(document.querySelector('.sentence-library').textContent, /需重练/);
  assert.ok(document.querySelector('[data-whole-entry]'));
  assert.ok(document.querySelector('[data-split-entry]'));

  dom.window.close();
});
