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

  const homeText = document.getElementById('app').textContent;
  assert.match(homeText, /今日新词/);
  assert.match(homeText, /今日复习/);
  assert.doesNotMatch(homeText, /词库总词数|当前到期|今日学习时间/);
  assert.match(homeText, /今日学习/);
  assert.ok(document.querySelector('.nav'), 'bottom navigation should render on Home');

  document.getElementById('goToday').click();
  await waitFor(() => document.querySelector('#startListen'));
  const todayText = document.getElementById('app').textContent;
  assert.match(todayText, /新词/);
  assert.match(todayText, /复习/);
  assert.match(todayText, /待巩固/);
  assert.match(todayText, /本轮单词清单/);
  assert.match(todayText, /调整今天的计划与词书/);
  assert.match(todayText, /东八区.*02:00/);
  assert.ok(document.querySelector('#todayPlanMode'), 'Today should expose mixed/sequential study mode');

  document.getElementById('startListen').click();
  await waitFor(() => document.querySelector('#judgeBad'));
  assert.ok(document.querySelector('.immersive'), 'learning mode should be immersive');
  assert.equal(document.querySelector('.nav'), null, 'bottom navigation must disappear during learning');
  assert.match(document.getElementById('retireWord').textContent, /标记简单/);
  assert.ok(document.querySelector('#studyListButton'), 'study screen should expose current-round checklist');
  document.getElementById('studyListButton').click();
  await waitFor(() => document.querySelector('.study-sheet'));
  assert.match(document.querySelector('.study-sheet').textContent, /新词/);
  assert.match(document.querySelector('.study-sheet').textContent, /复习词/);
  assert.match(document.querySelector('.study-sheet').textContent, /未开始|待巩固|已熟悉|简单/);
  document.getElementById('closeStudyList').click();

  document.getElementById('judgeBad').click();
  await waitFor(() => document.querySelector('#nextWord'));
  assert.match(document.getElementById('app').textContent, /不熟悉/);
  assert.ok(document.querySelector('.word'), 'answer must reveal the current English word');
  assert.ok(document.querySelector('#nextWord'), 'mobile Next button must be visible after judging');

  document.getElementById('listenBack').click();
  await waitFor(() => document.querySelector('[data-nav="type"]'));
  document.querySelector('[data-nav="type"]').click();
  await waitFor(() => document.querySelector('[data-type-preset="todayNew"]'));
  assert.match(document.getElementById('app').textContent, /今日新词可手打/);
  assert.match(document.getElementById('app').textContent, /今日复习可手打/);
  assert.ok(document.querySelector('[data-type-preset="todayReview"]'), 'hand-writing should have a review entry');

  document.querySelector('[data-nav="text"]').click();
  await waitFor(() => document.querySelector('#sentenceBookName'));
  assert.ok(document.querySelector('#sentenceProblemSearch'), 'sentence problems should be searchable');
  document.getElementById('sentenceBookName').value = '测试句子库';
  document.getElementById('sentenceDictationText').value = 'Rural areas.';
  document.getElementById('sentenceDictationText').dispatchEvent(new window.Event('input', { bubbles: true }));
  document.getElementById('startSentenceDictation').click();
  await waitFor(() => document.querySelector('#sentenceReveal'));

  document.getElementById('sentenceReveal').click();
  await waitFor(() => document.querySelector('#sentenceUnfamiliar'));
  assert.ok(document.querySelector('#sentenceSimple'), 'sentence dictation should allow marking a lexeme simple');
  assert.ok(document.querySelector('#sentenceSpeak'), 'the top speaker remains the replay control');
  assert.equal(document.querySelector('#sentenceUnknown'), null, 'sentence dictation should not expose a separate unknown button');
  assert.equal(document.querySelector('#sentenceReplay'), null, 'sentence dictation should not duplicate replay below the answer');
  document.getElementById('sentenceUnfamiliar').click();
  document.getElementById('sentenceNext').click();
  await waitFor(() => document.querySelector('#sentenceReveal'));
  document.getElementById('sentenceReveal').click();
  await waitFor(() => document.querySelector('#sentenceUnfamiliar'));
  document.getElementById('sentenceUnfamiliar').click();
  document.getElementById('sentenceNext').click();
  await waitFor(() => document.querySelector('#importSentenceBad'));

  assert.match(document.getElementById('app').textContent, /当前错词/);
  assert.match(document.getElementById('app').textContent, /FSRS/);
  document.getElementById('sentenceErrorBook').value = '测试句子错题本';
  document.getElementById('importSentenceBad').click();
  document.getElementById('finishSentence').click();
  await waitFor(() => document.querySelector('#sentenceProblemSearch'));
  assert.match(document.getElementById('app').textContent, /测试句子库/);
  document.getElementById('sentenceProblemSearch').value = 'rural';
  document.getElementById('sentenceProblemSearch').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(document.getElementById('sentenceProblemList').textContent, /Rural areas/);
  assert.match(document.getElementById('sentenceProblemList').textContent, /只重听这句错词/);

  document.querySelector('[data-nav="library"]').click();
  await waitFor(() => document.querySelector('#wordSearch'));
  const errorBook = [...document.querySelectorAll('.error-book')].find((el) => /测试句子错题本/.test(el.textContent));
  assert.ok(errorBook, 'named error book should be visible in the library');
  assert.equal(errorBook.open, false, 'error books should be collapsed by default');
  errorBook.open = true;
  assert.ok(errorBook.querySelector('.error-compact'), 'error-book words should use a compact list');
  document.getElementById('wordSearch').value = 'rural';
  document.getElementById('wordSearch').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(document.getElementById('app').textContent, /测试句子错题本/);
  assert.ok(document.querySelector('.compact-word'), 'normal vocabulary rows should also be compact');
  assert.match(document.querySelector('[data-retire]').textContent, /简单|恢复/);

  document.querySelector('[data-nav="text"]').click();
  await waitFor(() => document.querySelector('#newText'));
  document.getElementById('newText').click();
  await waitFor(() => document.querySelector('#textTitle'));
  document.getElementById('textTitle').value = 'Test linked sentence';
  document.getElementById('textCollection').value = '剑18';
  document.getElementById('textBody').value = 'The rural area is quiet. Another sentence follows.';
  document.getElementById('saveText').click();
  await waitFor(() => document.querySelector('[data-open-text]'));
  document.querySelector('[data-open-text]').click();
  await waitFor(() => document.querySelector('#dictateSentence'));
  assert.match(document.getElementById('dictateSentence').textContent, /拆词听写/);
  assert.ok(document.querySelector('#dictateWholeSentence'), 'text sentence should also offer true whole-sentence dictation');

  dom.window.close();
});
