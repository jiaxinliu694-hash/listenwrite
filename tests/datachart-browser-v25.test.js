import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

function waitFor(check, timeout = 2500) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try { if (check()) return resolve(); } catch {}
      if (Date.now() - start > timeout) return reject(new Error('Timed out waiting for data-chart render'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test('data-chart module is reachable, self-rated, and keeps bad items in 3/3 reinforcement', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="app"></div><div id="toast"></div>
    <input id="file-restore" type="file"><input id="file-import" type="file"><input id="file-text" type="file">
  </body>`, { url: 'https://example.test/' });
  const { window } = dom;
  const speechSynthesis = { cancel() {}, speak(u) { queueMicrotask(() => u.onend?.()); } };
  class SpeechSynthesisUtterance { constructor(text) { this.text=text; this.lang=''; this.rate=1; this.onend=null; } }
  globalThis.window=window;globalThis.document=window.document;globalThis.localStorage=window.localStorage;
  globalThis.indexedDB=indexedDB;globalThis.IDBKeyRange=IDBKeyRange;globalThis.speechSynthesis=speechSynthesis;
  globalThis.SpeechSynthesisUtterance=SpeechSynthesisUtterance;globalThis.confirm=()=>true;
  window.speechSynthesis=speechSynthesis;window.SpeechSynthesisUtterance=SpeechSynthesisUtterance;window.getSelection=()=>({toString:()=>''});
  if(!globalThis.URL.createObjectURL)globalThis.URL.createObjectURL=()=> 'blob:test';
  if(!globalThis.URL.revokeObjectURL)globalThis.URL.revokeObjectURL=()=>{};

  await import(`../src/app.js?datachart=${Date.now()}`);
  await waitFor(()=>document.querySelector('#goDataChart'));
  document.getElementById('goDataChart').click();
  await waitFor(()=>document.querySelector('#dcContinueLearn'));
  assert.match(document.getElementById('app').textContent,/数据图/);
  assert.match(document.getElementById('app').textContent,/第一次会就通过/);
  assert.doesNotMatch(document.getElementById('app').textContent,/FSRS/);
  assert.ok(document.querySelector('[data-nav="datachart"]'));

  document.getElementById('dcContinueLearn').click();
  await waitFor(()=>document.querySelector('#dcReveal'));
  assert.equal(document.querySelector('.nav'),null,'study run should be immersive');
  assert.ok(document.querySelector('.dc-cue'),'front should be a Chinese text cue');
  assert.equal(document.querySelector('.dc-cue img'),null,'V1 should not invent graphic prompts');
  document.getElementById('dcReveal').click();
  await waitFor(()=>document.querySelector('#dcBad'));
  assert.ok(document.querySelector('.dc-answer'));
  assert.ok(document.querySelector('#dcSpeak'),'TTS should be optional after reveal');
  document.getElementById('dcBad').click();
  await waitFor(()=>document.querySelector('#dcBack'));
  document.getElementById('dcBack').click();
  await waitFor(()=>document.querySelector('#dcWeak'));
  assert.equal(document.querySelector('#dcWeak .num').textContent,'1');
  assert.match(document.getElementById('app').textContent,/强化中条目/);

  dom.window.close();
});
