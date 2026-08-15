import test from 'node:test';
import assert from 'node:assert/strict';
import { startStudyActivity, setStudyActivityDate, flushStudyActivity, pauseStudyActivity, resumeStudyActivity, finishStudyActivity, studyActivityElapsedMs, activityTotalMs, formatStudyTime, normalizeActivities } from '../src/activity.js';

test('study timer accumulates only active visible spans',()=>{const s={activities:[]};const id=startStudyActivity(s,'listen','today',[],1000);setStudyActivityDate(s,id,'2026-08-15');flushStudyActivity(s,id,11000);pauseStudyActivity(s,id,16000);assert.equal(studyActivityElapsedMs(s,id,30000,true),15000);resumeStudyActivity(s,id,40000);assert.equal(studyActivityElapsedMs(s,id,45000,true),20000);finishStudyActivity(s,id,50000);assert.equal(studyActivityElapsedMs(s,id,90000,true),25000);assert.equal(activityTotalMs(s,{date:'2026-08-15'}),25000);});

test('old activities normalize as inactive so reload does not count closed-tab time',()=>{const rows=normalizeActivities([{id:'a',mode:'listen',start:1000,lastTouch:4000,activeMs:3000,active:true}],true,()=> '2026-08-15');assert.equal(rows[0].active,false);assert.equal(rows[0].activeMs,3000);});

test('timer formatting is visible-clock friendly',()=>{assert.equal(formatStudyTime(65000),'01:05');assert.equal(formatStudyTime(3661000),'01:01:01');});
