import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

function waitFor(check, timeout = 2500) {
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

test('browser shell renders core study and persistent sentence-book workflow', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="app"></div>
    <div id="toast"></div>
    <input id="file-restore" type="file">
    <input id="file-import" type="file">
    <input id="file-text" type="file">
  </body>`, { url: 'https://example.test/' });

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

  await import(`../src/app.js?smoke=${Date.now()}`);
  await waitFor(() => document.querySelector('#goToday'));

  assert.match(document.getElementById('app').textContent, /听词/);
  assert.match(document.getElementById('app').textContent, /今日学习/);
  assert.ok(document.querySelector('.nav'), 'bottom navigation should render on Home');

  document.getElementById('goToday').click();
  await waitFor(() => document.querySelector('#startListen'));
  const todayText = document.getElementById('app').textContent;
  assert.match(todayText, /新词/);
  assert.match(todayText, /复习/);
  assert.match(todayText, /待巩固/);
  assert.match(todayText, /调整今天的计划与词书/);
  assert.match(todayText, /东八区.*02:00/);
  assert.ok(document.querySelector('#todayPlanMode'), 'Today should expose mixed/sequential study mode');

  document.getElementById('startListen').click();
  await waitFor(() => document.querySelector('#judgeBad'));
  assert.ok(document.querySelector('.immersive'), 'learning mode should be immersive');
  assert.equal(document.querySelector('.nav'), null, 'bottom navigation must disappear during learning');

  document.getElementById('judgeBad').click();
  await waitFor(() => document.querySelector('#nextWord'));
  assert.match(document.getElementById('app').textContent, /不熟悉/);
  assert.ok(document.querySelector('.word'), 'answer must reveal the current English word');
  assert.ok(document.querySelector('#nextWord'), 'mobile Next button must be visible after judging');

  document.getElementById('listenBack').click();
  await waitFor(() => document.querySelector('[data-nav="text"]'));
  document.querySelector('[data-nav="text"]').click();
  await waitFor(() => document.querySelector('#sentenceBookName'));
  document.getElementById('sentenceBookName').value = '测试句子库';
  document.getElementById('sentenceDictationText').value = 'Rural areas.';
  document.getElementById('sentenceDictationText').dispatchEvent(new window.Event('input', { bubbles: true }));
  document.getElementById('startSentenceDictation').click();
  await waitFor(() => document.querySelector('#sentenceReveal'));

  document.getElementById('sentenceReveal').click();
  await waitFor(() => document.querySelector('#sentenceUnknown'));
  document.getElementById('sentenceUnknown').click();
  document.getElementById('sentenceNext').click();
  await waitFor(() => document.querySelector('#sentenceReveal'));
  document.getElementById('sentenceReveal').click();
  await waitFor(() => document.querySelector('#sentenceUnfamiliar'));
  document.getElementById('sentenceUnfamiliar').click();
  document.getElementById('sentenceNext').click();
  await waitFor(() => document.querySelector('#importSentenceBad'));

  assert.match(document.getElementById('app').textContent, /不熟\/不认识/);
  assert.match(document.getElementById('app').textContent, /2/);
  document.getElementById('sentenceErrorBook').value = '测试句子错题本';
  document.getElementById('importSentenceBad').click();
  document.getElementById('finishSentence').click();
  await waitFor(() => document.querySelector('[data-nav="library"]'));
  assert.match(document.getElementById('app').textContent, /测试句子库/);

  document.querySelector('[data-nav="library"]').click();
  await waitFor(() => document.querySelector('#wordSearch'));
  document.getElementById('wordSearch').value = 'rural';
  document.getElementById('wordSearch').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(document.getElementById('app').textContent, /测试句子错题本/);

  dom.window.close();
});
