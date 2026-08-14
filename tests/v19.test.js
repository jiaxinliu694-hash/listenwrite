import test from 'node:test';
import assert from 'node:assert/strict';
import { reinforcementGapWords, reinforcementState } from '../src/reinforcement.js';
import { createRetrySession, finishCurrent, nextRetryGap, pickNext } from '../src/queue.js';
import { defaultState, normalizeState } from '../src/storage.js';
import { spellingMatches } from '../src/tokenizer.js';

function evt(result,ts){return {result,ts};}
function state(){const s=defaultState();s.words=['a','b','c','d','e','f','g'].map(id=>({id,en:id,zh:id,sources:['A'],retired:false,card:null}));return s;}
function add(s,id,result,mode='listen',ts=1){s.events.push({id:'e'+s.events.length,wordId:id,date:'2026-08-14',ts,mode,result,cold:mode==='listen',attempt:1});}

test('reinforcement uses 5/8/12 intervening-word gaps',()=>{assert.equal(reinforcementGapWords([evt('bad',1)]),5);assert.equal(reinforcementGapWords([evt('bad',1),evt('good',2)]),8);assert.equal(reinforcementGapWords([evt('bad',1),evt('good',2),evt('good',3)]),12);assert.equal(reinforcementGapWords([evt('bad',1),evt('good',2),evt('good',3),evt('good',4)]),0);});

test('retry waits for five completed other cards, not wall clock',()=>{const s=state();add(s,'a','bad');const p={date:'2026-08-14',newIds:['a','b','c','d','e','f','g'],reviewIds:[]};const q=createRetrySession(s,p,'listen');const seen=[];for(let i=0;i<5;i++){const id=pickNext(q);assert.notEqual(id,'a');assert.ok(id);seen.push(id);add(s,id,'good','listen',10+q.turn);finishCurrent(q,'good',s);}assert.equal(new Set(seen).size,5);assert.equal(pickNext(q),'a');});

test('tail shortage never auto-passes and can use completed cards as non-scoring buffers',()=>{const s=state();add(s,'a','bad');add(s,'b','good');const p={date:'2026-08-14',newIds:['a','b'],reviewIds:[]};const q=createRetrySession(s,p,'listen');const id=pickNext(q);assert.equal(id,'b');assert.equal(q.current.source,'buffer');finishCurrent(q,'buffer');assert.equal(s.events.length,2);assert.equal(reinforcementState(s.events.filter(e=>e.wordId==='a')).passed,false);});

test('typing explicit sessions also reconstruct and enforce 3/3',()=>{const s=state();add(s,'a','bad','type');const p={date:'2026-08-14',newIds:['a','b','c','d','e','f','g'],reviewIds:[]};const q=createRetrySession(s,p,'type',['a','b','c','d','e','f','g']);assert.ok(q.retry.some(x=>x.wordId==='a'));for(let i=0;i<3;i++){add(s,'a','good','type',20+i);const r=reinforcementState(s.events.filter(e=>e.wordId==='a'&&e.mode==='type'));if(i<2)assert.equal(r.passed,false);else assert.equal(r.passed,true);} });

test('pending sentence meanings persist through normalization',()=>{const s=state();s.words[0].zh='';s.words[0].needsMeaning=true;const n=normalizeState(s);assert.equal(n.words[0].needsMeaning,true);n.words[0].zh='中文';n.words[0].needsMeaning=false;assert.equal(normalizeState(n).words[0].needsMeaning,false);});

test('IELTS numeric answers accept practical spoken/written equivalents',()=>{assert.equal(spellingMatches('twenty five pounds','£25'),true);assert.equal(spellingMatches('twenty percent','20%'),true);assert.equal(spellingMatches('eight thirty','8:30'),true);assert.equal(spellingMatches('sixth','6th'),true);assert.equal(spellingMatches('one hundred','100'),true);assert.equal(spellingMatches('twenty six','25'),false);});


test('reopening preserves already-earned intervening-word credit',()=>{
  const s=state();
  add(s,'a','bad','listen',1);
  for(let i=0;i<4;i++) add(s,['b','c','d','e'][i],'good','listen',2+i);
  const p={date:'2026-08-14',newIds:['a','b','c','d','e','f','g'],reviewIds:[]};
  const q=createRetrySession(s,p,'listen');
  assert.equal(nextRetryGap(q),1);
  assert.equal(pickNext(q),'f');
  add(s,'f','good','listen',10);
  finishCurrent(q,'good',s);
  assert.equal(pickNext(q),'a');
});

test('five persisted intervening judgments make a retry immediately eligible after reopen',()=>{
  const s=state();
  add(s,'a','bad','type',1);
  for(let i=0;i<5;i++) add(s,['b','c','d','e','f'][i],'good','type',2+i);
  const p={date:'2026-08-14',newIds:['a','b','c','d','e','f','g'],reviewIds:[]};
  const q=createRetrySession(s,p,'type',['a','b','c','d','e','f','g']);
  assert.equal(nextRetryGap(q),0);
  assert.equal(pickNext(q),'a');
});
