import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/storage.js';
import { recordAttempt, eventsOnDay } from '../src/engine.js';
import { ensureDailyPlan, createRetrySession, pickNext, finishCurrent, planStatus } from '../src/queue.js';
import { reinforcementState, reinforcementGapWords } from '../src/reinforcement.js';

function makeWords(n, source='A') {
  return Array.from({length:n}, (_,i)=>({ id:`w${i+1}`, en:`word${i+1}`, zh:'义', sources:[source], examples:[], retired:false, card:null }));
}
function makeState(n=50) {
  const s=defaultState();
  s.words=makeWords(n);
  s.settings.todayBooks=['A'];
  s.settings.defaultNewTarget=20;
  s.settings.defaultReviewTarget=0;
  return s;
}

test('one bad requires three consecutive good judgments, and another bad resets the streak', () => {
  const e=(result,ts)=>({result,ts});
  assert.equal(reinforcementState([e('bad',1)]).goodStreak,0);
  assert.equal(reinforcementState([e('bad',1),e('good',2)]).passed,false);
  assert.equal(reinforcementState([e('bad',1),e('good',2),e('good',3)]).passed,false);
  assert.equal(reinforcementState([e('bad',1),e('good',2),e('good',3),e('good',4)]).passed,true);
  const reset=reinforcementState([e('bad',1),e('good',2),e('good',3),e('bad',4),e('good',5)]);
  assert.equal(reset.goodStreak,1);
  assert.equal(reset.passed,false);
});

test('reinforcement word gaps increase across the three recovery steps', () => {
  const e=(result,ts)=>({result,ts});
  const afterBad=reinforcementGapWords([e('bad',1)]);
  const afterGood1=reinforcementGapWords([e('bad',1),e('good',2)]);
  const afterGood2=reinforcementGapWords([e('bad',1),e('good',2),e('good',3)]);
  assert.ok(afterBad > 0);
  assert.ok(afterGood1 > afterBad);
  assert.ok(afterGood2 > afterGood1);
});

test('retry waits for its minimum intervening-word gap when enough words exist', () => {
  const s=makeState(7); const date='2026-08-14';
  const p=ensureDailyPlan(s,{date,books:['A'],newTarget:7,reviewTarget:0});
  const session=createRetrySession(s,p,'listen');
  const id=pickNext(session);
  recordAttempt(s,s.words.find(w=>w.id===id),'listen','bad',{date,ts:1000});
  finishCurrent(session,'bad',s);
  const seen=[];
  for(let i=0;i<5;i++){const other=pickNext(session);assert.notEqual(other,id);seen.push(other);recordAttempt(s,s.words.find(w=>w.id===other),'listen','good',{date,ts:2000+i});finishCurrent(session,'good',s);}
  assert.equal(new Set(seen).size,5);
  assert.equal(pickNext(session),id);
});

test('raising today target preserves completed progress and only appends untouched words', () => {
  const s=makeState(50); const date='2026-08-14';
  let p=ensureDailyPlan(s,{date,books:['A'],newTarget:20,reviewTarget:0});
  const first=[...p.newIds];
  for(const id of first.slice(0,15)) recordAttempt(s,s.words.find(w=>w.id===id),'listen','good',{date,ts:1000+Number(id.slice(1))});
  assert.equal(planStatus(s,p).new.done,15);
  p=ensureDailyPlan(s,{date,newTarget:40});
  assert.equal(p.newIds.length,40);
  assert.equal(planStatus(s,p).new.done,15);
  for(const id of first.slice(0,15)) assert.ok(p.newIds.includes(id));
});

test('anything formally listened before today is review, with due status affecting priority rather than classification', () => {
  const s=makeState(4); const date='2026-08-14';
  const old='2026-08-13';
  recordAttempt(s,s.words[0],'listen','good',{date:old,ts:1000});
  recordAttempt(s,s.words[1],'listen','good',{date:old,ts:2000});
  s.words[0].card.due=1;
  s.words[1].card.due=Date.now()+86400000*10;
  const p=ensureDailyPlan(s,{date,books:['A'],newTarget:1,reviewTarget:2});
  assert.ok(p.reviewIds.includes('w1'));
  assert.ok(p.reviewIds.includes('w2'));
  assert.ok(!p.newIds.includes('w1')&&!p.newIds.includes('w2'));
});
