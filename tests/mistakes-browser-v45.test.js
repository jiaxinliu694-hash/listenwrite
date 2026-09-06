import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { addStudyDays, calendarDayKey } from '../src/studyday.js';

async function waitFor(fn) {
  for (let i=0;i<150;i++) { if (fn()) return; await new Promise(resolve=>setTimeout(resolve,20)); }
  throw new Error('Expected app view did not render');
}

test('v45 app navigates daily/book mistakes, checks cross-day words, reviews, retries and persists free-listening results', async () => {
  const dom = new JSDOM('<body><div id="app"></div><div id="toast"></div><input id="file-restore"><input id="file-import"><input id="file-text"></body>', {url:'https://example.test/'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=window.localStorage;
  globalThis.indexedDB=new IDBFactory();globalThis.confirm=()=>true;
  const spoken=[];
  globalThis.speechSynthesis=window.speechSynthesis={cancel(){},speak(u){spoken.push(u.text);},getVoices(){return [];}};
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  window.SpeechSynthesisUtterance=SpeechSynthesisUtterance;globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);
  const storage=await import('../src/storage.js');
  const today=calendarDayKey(), yesterday=addStudyDays(today,-1), ts=Date.parse(`${yesterday}T04:00:00Z`);
  const raw=storage.defaultState();
  raw.words=[{id:'w1',en:'leader',zh:'领导者 <img src=x onerror=alert(1)>',sources:['A','Green'],examples:[]},
    {id:'w2',en:'manager',zh:'经理',sources:['A'],examples:[]}];
  raw.events=[{id:'old1',wordId:'w1',ts,date:yesterday,mode:'listen',result:'bad'},
    {id:'old2',wordId:'w2',ts:ts+1,date:yesterday,mode:'listen',result:'bad'},
    {id:'old3',wordId:'w1',ts:ts+86400000,date:today,mode:'listen',result:'bad'}];
  await storage.saveState(raw); await import('../src/app.js?mistakes-v45');
  await waitFor(()=>document.getElementById('goMistakes'));
  document.getElementById('goMistakes').click();
  assert.ok(document.getElementById('mistakes-page'));assert.equal(document.querySelector('img'),null);
  assert.equal(document.getElementById('mistakeFrom').value,yesterday);
  assert.equal(document.querySelectorAll('[data-mistake-word]').length,2);
  document.getElementById('mistakeBook').value='Green';document.getElementById('mistakeBook').dispatchEvent(new window.Event('change'));
  assert.equal(document.querySelectorAll('[data-mistake-word]').length,1);
  document.getElementById('mistakeBook').value='';document.getElementById('mistakeBook').dispatchEvent(new window.Event('change'));
  document.querySelector('[data-mistake-range="all"]').click();
  assert.equal(document.querySelectorAll('[data-mistake-word]').length,3);
  document.getElementById('mistakeSelectAll').click();
  assert.match(document.getElementById('mistakeSelectedCount').textContent,/已选 2 个词/);
  assert.equal(document.getElementById('mistakes-page').dataset.cloudEditing,'true');
  await storage.flushStateWrites();
  const before=await storage.readPersistedState();
  document.getElementById('mistakeSpelling').click();
  document.getElementById('mistakeAnswer').value='totallywrong';
  document.getElementById('mistakeAnswerForm').dispatchEvent(new window.Event('submit',{cancelable:true}));
  assert.ok(document.querySelector('.word.bad')); assert.equal(document.querySelector('img'),null);
  document.getElementById('mistakeNext').click();
  document.getElementById('mistakeAnswer').value=spoken.at(-1);
  document.getElementById('mistakeAnswerForm').dispatchEvent(new window.Event('submit',{cancelable:true}));
  document.getElementById('mistakeNext').click();
  assert.match(document.getElementById('app').textContent,/答对 1 · 仍错 1 · 跳过 0/);
  document.getElementById('mistakeRetry').click();
  document.getElementById('mistakeAnswer').value=spoken.at(-1);
  document.getElementById('mistakeAnswerForm').dispatchEvent(new window.Event('submit',{cancelable:true}));
  document.getElementById('mistakeNext').click();document.getElementById('mistakeRunBack').click();
  await storage.flushStateWrites();
  const after=await storage.readPersistedState();
  assert.equal(after.vocabPracticeEvents.length,3);assert.deepEqual(after.events,before.events);
  assert.deepEqual(after.words,before.words);assert.deepEqual(after.dailyPlans,before.dailyPlans);
  assert.ok(document.getElementById('mistakes-page'));
  // A second review is allowed even after today's correct spelling.
  document.getElementById('mistakeListen').click();document.getElementById('mistakeGood').click();
  document.getElementById('mistakeRunBack').click();
  document.querySelector('[data-nav="library"]').click();
  document.getElementById('freeListenSelect').value='A';document.getElementById('startFreeListen').click();
  document.getElementById('freeBad').click();document.getElementById('freeBack').click();
  await storage.flushStateWrites();
  const saved=await storage.readPersistedState();
  assert.equal(saved.vocabPracticeEvents.at(-1).mode,'free');assert.equal(saved.vocabPracticeEvents.at(-1).result,'bad');
  assert.deepEqual(saved.vocabPracticeEvents.at(-1).studyBooks,['A']);
  assert.deepEqual(saved.events,before.events);assert.deepEqual(saved.words,before.words);
  assert.deepEqual(storage.normalizeState(saved).vocabPracticeEvents,saved.vocabPracticeEvents);
  document.querySelector('[data-nav="mistakes"]').click();
  document.querySelector('[data-mistake-range="today"]').click();
  assert.match(document.getElementById('mistakes-page').textContent,/自由听/);
  dom.window.close();
});
