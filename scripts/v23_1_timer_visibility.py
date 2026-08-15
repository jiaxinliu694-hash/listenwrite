from pathlib import Path


def patch(path, old, new):
    p=Path(path)
    s=p.read_text()
    if old not in s:
        raise SystemExit(f'missing pattern in {path}: {old[:100]}')
    p.write_text(s.replace(old,new,1))

# Make the timer visibly part of the progress header when one exists, with a fixed fallback on finish screens.
old = '''function mountStudyTimer(activityId){
  clearInterval(studyTimerInterval);studyTimerInterval=null;if(!activityId)return;
  let badge=document.getElementById('studyTimer');if(!badge){badge=document.createElement('div');badge.id='studyTimer';badge.className='study-timer';document.querySelector('.immersive')?.appendChild(badge);}
  const draw=()=>{const el=document.getElementById('studyTimer');if(el)el.textContent='本轮 '+formatStudyTime(studyActivityElapsedMs(state,activityId,Date.now(),!document.hidden));};draw();studyTimerInterval=setInterval(draw,1000);studyTimerInterval?.unref?.();
}
'''
new = '''function mountStudyTimer(activityId){
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
'''
patch('src/app.js', old, new)

# Replace the subtle single floating style with an obvious inline timer plus fallback.
css=Path('styles.css')
s=css.read_text()
old_css=".study-timer{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:45;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,253,249,.96);box-shadow:0 8px 26px rgba(58,51,40,.12);font-variant-numeric:tabular-nums;font-size:12px;font-weight:700;color:var(--ink)}"
new_css=".study-timer{font-variant-numeric:tabular-nums;font-weight:750;color:var(--ink)}.study-timer-inline{display:block;width:max-content;margin:5px auto 0;padding:4px 9px;border:1px solid rgba(90,80,65,.16);border-radius:999px;background:rgba(255,253,249,.9);font-size:12px;line-height:1.2}.study-timer-float{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:45;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,253,249,.96);box-shadow:0 8px 26px rgba(58,51,40,.12);font-size:12px}"
if old_css not in s:
    raise SystemExit('timer css missing')
css.write_text(s.replace(old_css,new_css,1))

# Cache-bust the two files that determine timer presence/appearance.
idx=Path('index.html')
s=idx.read_text()
s=s.replace('href="./styles.css"','href="./styles.css?v=23.1"')
s=s.replace('src="./app.bundle.js"','src="./app.bundle.js?v=23.1"')
idx.write_text(s)

# Regression checks: bundle build will prove source integration, while these guard visibility and cache busting.
Path('tests/v23_1.test.js').write_text('''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('study timer is mounted inline with the study progress header',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes("progress.appendChild(badge)"));
  assert.ok(app.includes("study-timer-inline"));
  assert.ok(app.includes("本轮 "));
});

test('static assets are cache-busted for timer rollout',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('styles.css?v=23.1'));
  assert.ok(html.includes('app.bundle.js?v=23.1'));
});
''')
print('v23.1 timer visibility hotfix applied')
