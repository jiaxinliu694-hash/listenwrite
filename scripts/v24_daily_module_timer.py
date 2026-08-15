from pathlib import Path


def patch(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'missing pattern in {path}: {old[:100]}')
    p.write_text(s.replace(old,new,1))

# Shared daily cumulative timer helper. Count persisted activeMs from every session in the module,
# plus only the unflushed live delta of the currently open session.
activity=Path('src/activity.js')
s=activity.read_text()
needle="""export function activityMinutes(state, mode = null, date = null) {
  const ms = activityTotalMs(state, { mode, date });
  return ms ? Math.max(1, Math.round(ms / 60_000)) : 0;
}
"""
replacement=needle+"""
export function dailyModuleElapsedMs(state, mode, date, activeId = null, now = Date.now(), visible = true) {
  let total = activityTotalMs(state, { mode, date });
  if (!activeId) return total;
  const active = activityById(state, activeId);
  if (!active || active.mode !== mode || active.date !== date) return total;
  const live = studyActivityElapsedMs(state, activeId, now, visible);
  const flushed = Math.max(0, Number(active.activeMs) || 0);
  return total + Math.max(0, live - flushed);
}
"""
if needle not in s: raise SystemExit('activityMinutes block missing')
activity.write_text(s.replace(needle,replacement,1))

app=Path('src/app.js'); s=app.read_text()
s=s.replace("activityTotalMs, formatStudyTime } from './activity.js';","activityTotalMs, dailyModuleElapsedMs, formatStudyTime } from './activity.js';")
old="""function mountStudyTimer(activityId){
  clearInterval(studyTimerInterval);studyTimerInterval=null;if(!activityId)return;
  let badge=document.getElementById('studyTimer');
  if(!badge){
    badge=document.createElement('span');badge.id='studyTimer';
    const progress=document.querySelector('.studyprogress');
    if(progress){badge.className='study-timer study-timer-inline';progress.appendChild(badge);}
    else{badge.className='study-timer study-timer-float';document.querySelector('.immersive')?.appendChild(badge);}
  }
  const draw=()=>{const el=document.getElementById('studyTimer');if(el)el.textContent='本轮 '+formatStudyTime(studyActivityElapsedMs(state,activityId,Date.now(),!document.hidden));};draw();studyTimerInterval=setInterval(draw,1000);studyTimerInterval?.unref?.();
}
"""
new="""function moduleTimerLabel(mode){return mode==='listen'?'今日听词':mode==='type'?'今日手打':mode==='sentence'?'今日句子':mode==='free'?'今日自由听':'今日学习';}
function mountStudyTimer(activityId){
  clearInterval(studyTimerInterval);studyTimerInterval=null;if(!activityId)return;
  const activity=(state.activities||[]).find(item=>item.id===activityId);if(!activity)return;
  let badge=document.getElementById('studyTimer');
  if(!badge){
    badge=document.createElement('span');badge.id='studyTimer';
    const progress=document.querySelector('.studyprogress');
    if(progress){badge.className='study-timer study-timer-inline';progress.appendChild(badge);}
    else{badge.className='study-timer study-timer-float';document.querySelector('.immersive')?.appendChild(badge);}
  }
  const draw=()=>{const el=document.getElementById('studyTimer');if(!el)return;const date=currentDayKey();const elapsed=dailyModuleElapsedMs(state,activity.mode,date,activityId,Date.now(),!document.hidden);el.textContent=moduleTimerLabel(activity.mode)+' '+formatStudyTime(elapsed);};
  draw();studyTimerInterval=setInterval(draw,1000);studyTimerInterval?.unref?.();
}
"""
if old not in s: raise SystemExit('mountStudyTimer block missing')
app.write_text(s.replace(old,new,1))

# Force Safari/PWA to fetch the new timer semantics.
idx=Path('index.html'); s=idx.read_text(); s=s.replace('styles.css?v=23.1','styles.css?v=24').replace('app.bundle.js?v=23.1','app.bundle.js?v=24'); idx.write_text(s)

# Update the previous timer rollout regression: its placement stays the same, but the label and asset version evolved.
v231=Path('tests/v23_1.test.js'); s=v231.read_text(); s=s.replace('assert.ok(app.includes("本轮 "));','assert.ok(app.includes("今日听词"));').replace("styles.css?v=23.1","styles.css?v=24").replace("app.bundle.js?v=23.1","app.bundle.js?v=24"); v231.write_text(s)

Path('tests/v24.test.js').write_text('''import test from 'node:test';
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
  assert.ok(html.includes('app.bundle.js?v=24'));
});
''')
print('v24 daily module timer patch applied')
