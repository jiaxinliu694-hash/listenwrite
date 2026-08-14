import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDailyPlan } from '../src/queue.js';
import { defaultState } from '../src/storage.js';

function base() {
  const s = defaultState();
  s.settings.defaultNewTarget = 2;
  s.settings.defaultReviewTarget = 2;
  s.words = [
    { id:'shared', en:'shared', sources:['示例词库','爱听写'], retired:false, card:null },
    { id:'sampleOnly', en:'sampleonly', sources:['示例词库'], retired:false, card:null },
    { id:'loveOnly', en:'loveonly', sources:['爱听写'], retired:false, card:null },
    { id:'loveOnly2', en:'loveonly2', sources:['爱听写'], retired:false, card:null },
  ];
  return s;
}

function hear(s, id, result='bad') {
  s.events.push({ id:`ev-${id}`, wordId:id, date:'2026-08-14', ts:1, mode:'listen', result, cold:true, attempt:1 });
}

test('deselected exclusive-book pending word cannot leak into the new scope', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['sampleOnly','shared'];
  hear(s, 'sampleOnly', 'bad');
  hear(s, 'shared', 'bad');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:2, reviewTarget:2 });
  assert.ok(!p.newIds.includes('sampleOnly'));
  assert.ok(!p.reviewIds.includes('sampleOnly'));
  assert.equal(s.events.some(e => e.wordId === 'sampleOnly'), true, 'history is preserved');
});

test('same-day shared word re-entering through another book becomes review', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['shared','sampleOnly'];
  hear(s, 'shared', 'bad');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:2, reviewTarget:2 });
  assert.ok(!p.newIds.includes('shared'));
  assert.ok(p.reviewIds.includes('shared'));
});

test('expanding scope while keeping the same selected source does not relabel a new word', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['shared','sampleOnly'];
  hear(s, 'shared', 'bad');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库','爱听写'], newTarget:2, reviewTarget:2 });
  assert.ok(p.newIds.includes('shared'));
  assert.ok(!p.reviewIds.includes('shared'));
});
