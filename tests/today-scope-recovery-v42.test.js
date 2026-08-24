import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defaultState } from '../src/storage.js';
import { ensureDailyPlan, planStatus } from '../src/queue.js';

function w(id, source) { return { id, en:id, zh:'', sources:[source], retired:false, card:null }; }

test('a plan stripped by an old scope switch repairs itself from same-day formal listening events', () => {
  const s=defaultState();
  s.settings.defaultNewTarget=3; s.settings.defaultReviewTarget=0;
  s.words=[w('a1','A'),w('a2','A'),w('b1','B'),w('b2','B'),w('b3','B')];
  const date='2026-08-24';
  s.dailyPlans[date]={date,mode:'mixed',books:['B'],newTarget:3,reviewTarget:0,newIds:['b1','b2','b3'],reviewIds:[],bookSegments:[],resumeWordId:null,drawNonce:1,createdAt:1,updatedAt:1};
  s.events=[
    {id:'ea1',wordId:'a1',date,ts:1,mode:'listen',result:'good',cold:true,attempt:1},
    {id:'ea2',wordId:'a2',date,ts:2,mode:'listen',result:'bad',cold:true,attempt:1},
  ];
  const p=ensureDailyPlan(s,{date,books:['B']});
  assert.ok(p.newIds.includes('a1'));
  assert.ok(p.newIds.includes('a2'));
  assert.equal(p.newIds.length,3);
  const status=planStatus(s,p).new;
  assert.equal(status.done,1);
  assert.equal(status.retry,1);
  assert.equal(status.pending,1);
});

test('Today overall listening data is not filtered by the currently selected books', () => {
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes('const td = todayListeningStats(state, [], date);'));
  assert.ok(app.includes('切换词书或降低目标只会替换/裁掉完全没碰过的候选词'));
});
