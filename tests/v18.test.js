import test from 'node:test';
import assert from 'node:assert/strict';
import { configureSequentialPlan, ensureDailyPlan } from '../src/queue.js';
import { defaultState } from '../src/storage.js';
import { reinforcementState } from '../src/reinforcement.js';
import { typePresetIds } from '../src/typefilters.js';
import { wordStudyKind } from '../src/studyidentity.js';

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

let seq = 0;
function hear(s, id, result='bad', date='2026-08-14') {
  seq += 1;
  s.events.push({ id:`ev-${seq}`, wordId:id, date, ts:seq * 1000, mode:'listen', result, cold:!s.events.some(e=>e.wordId===id&&e.date===date&&e.mode==='listen'), attempt:s.events.filter(e=>e.wordId===id&&e.date===date&&e.mode==='listen').length+1 });
}

function passAfterMiss(s, id) {
  hear(s,id,'bad'); hear(s,id,'good'); hear(s,id,'good'); hear(s,id,'good');
}

test('study identity depends on pre-day formal listening, not same-day cross-book exposure', () => {
  const s = base();
  hear(s,'shared','bad');
  assert.equal(wordStudyKind(s,'shared','2026-08-14'),'new');
  hear(s,'loveOnly','good','2026-08-13');
  assert.equal(wordStudyKind(s,'loveOnly','2026-08-14'),'review');
});

test('deselected exclusive-book touched word remains in Today after switching scope', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['sampleOnly','shared'];
  hear(s, 'sampleOnly', 'bad');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:2, reviewTarget:2 });
  assert.ok(p.newIds.includes('sampleOnly'));
  assert.ok(!p.reviewIds.includes('sampleOnly'));
  assert.equal(s.events.some(e => e.wordId === 'sampleOnly'), true, 'history is preserved');
});

test('same-day shared pending word remains new and keeps its reinforcement state after switching books', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['shared','sampleOnly'];
  hear(s, 'shared', 'bad');
  hear(s, 'shared', 'good');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:2, reviewTarget:2 });
  assert.ok(p.newIds.includes('shared'));
  assert.ok(!p.reviewIds.includes('shared'));
  const r = reinforcementState(s.events.filter(e=>e.wordId==='shared'&&e.date==='2026-08-14'&&e.mode==='listen'));
  assert.equal(r.passed,false);
  assert.equal(r.goodStreak,1);
});

test('same-day shared word already passed 3/3 remains in the fixed Today denominator after switching books', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['shared','sampleOnly'];
  passAfterMiss(s,'shared');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:2, reviewTarget:0 });
  assert.ok(p.newIds.includes('shared'));
  assert.ok(!p.reviewIds.includes('shared'));
  assert.equal(p.newIds.length,2);
  assert.equal(p.newIds.filter(id=>['loveOnly','loveOnly2'].includes(id)).length,1, 'only one untouched slot is redrawn from the current book');
});

test('shared word heard before today enters the newly selected book as review', () => {
  const s = base();
  hear(s,'shared','good','2026-08-13');
  const p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:0, reviewTarget:2 });
  assert.ok(p.reviewIds.includes('shared'));
  assert.ok(!p.newIds.includes('shared'));
});

test('sequential mode carries unfinished shared words into the selected book without relabeling them', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  configureSequentialPlan(s,p,[{book:'示例词库',newTarget:2,reviewTarget:0}]);
  hear(s,'shared','bad');
  configureSequentialPlan(s,p,[{book:'爱听写',newTarget:2,reviewTarget:0}]);
  const seg = p.bookSegments[0];
  assert.ok(seg.newIds.includes('shared'));
  assert.ok(!seg.reviewIds.includes('shared'));
  assert.ok(!seg.newIds.includes('sampleOnly'));
});

test('typing today-new/today-review presets use the same cross-day identity rule', () => {
  const s = base();
  hear(s,'shared','bad');
  hear(s,'loveOnly','good','2026-08-13');
  hear(s,'loveOnly','bad','2026-08-14');
  const candidates = s.words.filter(w=>w.sources.includes('爱听写'));
  const deliberatelyStalePlan = { newIds:['loveOnly'], reviewIds:['shared'] };
  assert.deepEqual(typePresetIds(s,candidates,'todayNew','2026-08-14',deliberatelyStalePlan),['shared']);
  assert.deepEqual(typePresetIds(s,candidates,'todayReview','2026-08-14',deliberatelyStalePlan),['loveOnly']);
});
