import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDayKey, studyDayStart, studyDayEnd, addStudyDays } from '../src/studyday.js';
import { tokenizeEnglish, spellingMatches } from '../src/tokenizer.js';
import { emptyCard } from '../src/scheduler.js';
import { ensureDailyPlan } from '../src/queue.js';
import { activeStudyDayKey, isDailyPlanComplete, recordAttempt } from '../src/engine.js';

function tsChina(y,m,d,h,min=0){return Date.UTC(y,m-1,d,h-8,min,0,0);}
function word(id){return{id,en:id,zh:'义',pos:'',def:'',sources:['A'],examples:[],retired:false,card:emptyCard()};}
function state(words,settings={}){return{version:5,words,events:[],texts:[],dailyPlans:{},activities:[],settings:{defaultNewTarget:40,defaultReviewTarget:80,retention:.9,speechRate:.92,todayBooks:[],typeBooks:[],...settings}};}

test('UTC+8 calendar day normally rolls over at 24:00',()=>{
  assert.equal(calendarDayKey(tsChina(2026,8,14,23,59)),'2026-08-14');
  assert.equal(calendarDayKey(tsChina(2026,8,15,0,0)),'2026-08-15');
  assert.equal(calendarDayKey(studyDayStart('2026-08-15')),'2026-08-15');
  assert.equal(calendarDayKey(studyDayEnd('2026-08-15')),'2026-08-15');
  assert.equal(addStudyDays('2026-08-31',1),'2026-09-01');
});

test('00:00-02:00 keeps previous day only while its listening plan is unfinished',()=>{
  const w=word('w1');
  const S=state([w],{defaultNewTarget:1,defaultReviewTarget:0});
  ensureDailyPlan(S,{date:'2026-08-14',books:['A'],newTarget:1,reviewTarget:0});
  const t0030=tsChina(2026,8,15,0,30);
  assert.equal(activeStudyDayKey(S,t0030),'2026-08-14');
  assert.equal(isDailyPlanComplete(S,'2026-08-14',t0030),false);

  const final=recordAttempt(S,w,'listen','good',{ts:tsChina(2026,8,15,0,45)});
  assert.equal(final.date,'2026-08-14','the answer that completes the old plan still belongs to the old day');
  assert.equal(isDailyPlanComplete(S,'2026-08-14',tsChina(2026,8,15,0,45)),true);
  assert.equal(activeStudyDayKey(S,tsChina(2026,8,15,0,45,)),'2026-08-15','completion immediately opens the new study day');
});

test('02:00 forces rollover even when previous day is unfinished',()=>{
  const S=state([word('w1')],{defaultNewTarget:1,defaultReviewTarget:0});
  ensureDailyPlan(S,{date:'2026-08-14',books:['A'],newTarget:1,reviewTarget:0});
  assert.equal(activeStudyDayKey(S,tsChina(2026,8,15,1,59)),'2026-08-14');
  assert.equal(activeStudyDayKey(S,tsChina(2026,8,15,2,0)),'2026-08-15');
});

test('a completed previous day switches at midnight with no grace carry',()=>{
  const w=word('w1');
  const S=state([w],{defaultNewTarget:1,defaultReviewTarget:0});
  ensureDailyPlan(S,{date:'2026-08-14',books:['A'],newTarget:1,reviewTarget:0});
  recordAttempt(S,w,'listen','good',{ts:tsChina(2026,8,14,23,50),date:'2026-08-14'});
  assert.equal(activeStudyDayKey(S,tsChina(2026,8,15,0,10)),'2026-08-15');
});

test('lowering today target removes only untouched cards and never makes done exceed denominator',()=>{
  const words=Array.from({length:60},(_,i)=>word(`w${i+1}`));
  const S=state(words,{defaultNewTarget:40,defaultReviewTarget:0});
  const plan=ensureDailyPlan(S,{books:['A']});
  assert.equal(plan.newIds.length,40);
  for(const id of plan.newIds.slice(0,20))recordAttempt(S,S.words.find(w=>w.id===id),'listen','good');
  ensureDailyPlan(S,{newTarget:30});
  assert.equal(plan.newTarget,30);
  assert.equal(plan.newIds.length,30);
  for(const id of plan.newIds.slice(20,36))recordAttempt(S,S.words.find(w=>w.id===id),'listen','good');
  ensureDailyPlan(S,{newTarget:25});
  assert.equal(plan.newTarget,30,'only 30 cards remain after previous trim; attempted floor is preserved');
  assert.equal(plan.newIds.length,30);
});

test('future defaults do not mutate an existing Today plan',()=>{
  const S=state(Array.from({length:100},(_,i)=>word(`w${i+1}`)),{defaultNewTarget:40,defaultReviewTarget:0});
  const plan=ensureDailyPlan(S,{books:['A']});
  assert.equal(plan.newTarget,40);
  S.settings.defaultNewTarget=50;
  const same=ensureDailyPlan(S,{books:['A']});
  assert.equal(same.newTarget,40);
  const tomorrow=ensureDailyPlan(S,{date:addStudyDays(activeStudyDayKey(S),1),books:['A']});
  assert.equal(tomorrow.newTarget,50);
});

test('sentence tokenizer preserves surface word forms and can de-duplicate',()=>{
  const s="The farmers are working in rural areas, and the farmers aren't leaving.";
  assert.deepEqual(tokenizeEnglish(s),['The','farmers','are','working','in','rural','areas','and','the','farmers',"aren't",'leaving']);
  assert.deepEqual(tokenizeEnglish(s,{unique:true}),['The','farmers','are','working','in','rural','areas','and',"aren't",'leaving']);
  assert.equal(spellingMatches('Farmers','farmers'),true);
  assert.equal(spellingMatches('farmer','farmers'),false);
});
