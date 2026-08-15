import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startStudyActivity, setStudyActivityDate, flushStudyActivity, finishStudyActivity, dailyModuleElapsedMs } from '../src/activity.js';

test('daily module timer accumulates multiple sessions and live current delta',()=>{
  const s={activities:[]};
  const a=startStudyActivity(s,'listen','morning',[],1000);setStudyActivityDate(s,a,'2026-08-15');flushStudyActivity(s,a,61000);finishStudyActivity(s,a,61000);
  const b=startStudyActivity(s,'listen','afternoon',[],100000);setStudyActivityDate(s,b,'2026-08-15');flushStudyActivity(s,b,130000);
  assert.equal(dailyModuleElapsedMs(s,'listen','2026-08-15',b,140000,true),100000);
});

test('daily module timer keeps modes separate',()=>{
  const s={activities:[]};
  const l=startStudyActivity(s,'listen','listen',[],1000);setStudyActivityDate(s,l,'2026-08-15');flushStudyActivity(s,l,31000);
  const t=startStudyActivity(s,'type','type',[],1000);setStudyActivityDate(s,t,'2026-08-15');flushStudyActivity(s,t,46000);
  assert.equal(dailyModuleElapsedMs(s,'listen','2026-08-15',l,31000,false),30000);
  assert.equal(dailyModuleElapsedMs(s,'type','2026-08-15',t,46000,false),45000);
});

test('study UI labels the timer as today module time rather than current round',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes("mode==='listen'?'今日听词'"));
  assert.ok(app.includes("mode==='type'?'今日手打'"));
  assert.ok(!app.includes("el.textContent='本轮 '"));
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('app.bundle.js?v=32'));
});
