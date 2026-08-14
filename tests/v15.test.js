import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDailyPlan } from '../src/queue.js';
import { defaultState, normalizeState } from '../src/storage.js';

function stateWithWords() {
  const s = defaultState();
  s.settings.defaultNewTarget = 3;
  s.settings.defaultReviewTarget = 2;
  s.words = [
    { id:'a', en:'alpha', sources:['A'], retired:false, card:null },
    { id:'b', en:'bravo', sources:['A'], retired:false, card:null },
    { id:'c', en:'charlie', sources:['A'], retired:false, card:null },
    { id:'d', en:'delta', sources:['A'], retired:false, card:null },
    { id:'e', en:'echo', sources:['B'], retired:false, card:null },
    { id:'f', en:'foxtrot', sources:['B'], retired:false, card:null },
    { id:'g', en:'golf', sources:['B'], retired:false, card:null },
    { id:'h', en:'hotel', sources:['B'], retired:false, card:null },
  ];
  return s;
}

test('new-word draw is stable within one scope but redraws when book scope changes', () => {
  const s = stateWithWords();
  const date = '2026-08-14';
  let p = ensureDailyPlan(s, { date, books:['A'] });
  const first = [...p.newIds];
  assert.equal(first.length, 3);
  assert.ok(first.every(id => ['a','b','c','d'].includes(id)));
  p = ensureDailyPlan(s, { date, books:['A'] });
  assert.deepEqual(p.newIds, first);
  p = ensureDailyPlan(s, { date, books:['B'] });
  assert.equal(p.newIds.length, 3);
  assert.ok(p.newIds.every(id => ['e','f','g','h'].includes(id)));
  const bDraw = [...p.newIds];
  p = ensureDailyPlan(s, { date, books:['A'] });
  assert.equal(p.newIds.length, 3);
  assert.ok(p.newIds.every(id => ['a','b','c','d'].includes(id)));
  assert.notDeepEqual(p.newIds, bDraw);
});

test('deselected book disappears from today plan while its completed learning event remains', () => {
  const s = stateWithWords();
  const date = '2026-08-14';
  let p = ensureDailyPlan(s, { date, books:['A'] });
  const heard = p.newIds[0];
  s.events.push({ id:'ev1', wordId:heard, date, ts:1, mode:'listen', result:'good', cold:true, attempt:1 });
  p = ensureDailyPlan(s, { date, books:['B'] });
  assert.ok(!p.newIds.includes(heard) && !p.reviewIds.includes(heard));
  assert.equal(s.events.some(e => e.wordId === heard), true);
  p = ensureDailyPlan(s, { date, books:['A'] });
  assert.ok(!p.newIds.includes(heard) && !p.reviewIds.includes(heard), 'already-passed words do not consume another Today slot when reselecting the book');
});

test('promoted wrong words are review candidates, not new words, without inventing FSRS history', () => {
  const s = stateWithWords();
  s.words[0].reviewHint = true;
  const p = ensureDailyPlan(s, { date:'2026-08-14', books:['A'], newTarget:2, reviewTarget:2 });
  assert.ok(p.reviewIds.includes('a'));
  assert.ok(!p.newIds.includes('a'));
  assert.equal(s.events.length, 0);
});

test('reviewHint and drawNonce survive normalization', () => {
  const s = stateWithWords();
  s.words[0].reviewHint = true;
  s.dailyPlans['2026-08-14'] = { date:'2026-08-14', mode:'mixed', books:['A'], newTarget:2, reviewTarget:1, newIds:[], reviewIds:['a'], drawNonce:4 };
  const n = normalizeState(s);
  assert.equal(n.words[0].reviewHint, true);
  assert.equal(n.dailyPlans['2026-08-14'].drawNonce, 4);
});
