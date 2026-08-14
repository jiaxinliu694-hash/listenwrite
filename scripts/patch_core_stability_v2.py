from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'data-core-stability-v2' in s:
    print('core stability v2 already present')
    raise SystemExit(0)
if 'data-core-stability-v1' not in s:
    raise SystemExit('core stability v1 must run first')
s=s.replace('</style>','/* data-core-stability-v2 */\n</style>',1)

# Daily-plan completion must only follow listening events, never a later hand-writing event.
old="function latestTodayEvent(wordId){var d=day(),a=S.events.filter(function(e){return e.wordId===wordId&&e.date===d}).sort(function(a,b){return a.ts-b.ts});return a.length?a[a.length-1]:null}"
new="function latestTodayListenEvent(wordId){var d=day(),a=S.events.filter(function(e){return e.wordId===wordId&&e.date===d&&e.mode==='listen'}).sort(function(a,b){return a.ts-b.ts});return a.length?a[a.length-1]:null}"
if old not in s: raise SystemExit('latestTodayEvent target not found')
s=s.replace(old,new,1).replace('var le=latestTodayEvent(idv),listened=todayListenEvents(idv).length>0','var le=latestTodayListenEvent(idv),listened=todayListenEvents(idv).length>0',1)

# Keep retry membership synchronized when revisiting a base-plan card and changing the judgment.
pat=r"function judge\(r\)\{.*?\}\nfunction next\(skip\)"
m=re.search(pat,s,re.S)
if not m: raise SystemExit('listen judge block not found')
judge=r'''function judge(r){var w=cw(),m=currentAttemptMeta();if(!sess.show){var no=(sess.attempts[w.id]||0)+1;sess.attempts[w.id]=no;ev(w,'listen',r);m={eventId:S.events[S.events.length-1].id,res:r,attemptNo:no};if(sess.inRetry)sess.currentMeta=m;else sess.meta[sess.i]=m;sess.show=true;sess.res=r;if(sess.activityId)touchActivity(sess.activityId)}else if(sess.res!==r){m=currentAttemptMeta();if(m){var e=S.events.find(function(x){return x.id===m.eventId});if(e)e.res=r;m.res=r;rebuildWordSchedule(w);save()}sess.res=r}if(r==='good'){sessionMarkDone(w);if(!sess.inRetry)sessionRemoveRetry(w)}else{sessionUnmarkDone(w);if(!sess.inRetry)sessionAddRetry(w)}study()}
function next(skip)'''
s=s[:m.start()]+judge+s[m.end():]

# Hand-writing result summary uses each word's final judgment, not every intermediate failure.
pat=r"function typeFinish\(\)\{.*?\}\nfunction typeCard\(\)"
m=re.search(pat,s,re.S)
if not m: raise SystemExit('typeFinish block not found')
typefinish=r'''function typeFinish(){if(ts&&ts.activityId)endActivity(ts.activityId);document.body.classList.remove('focusType');var a=ts.done||[],lastBy={},seen={};a.forEach(function(x){lastBy[x.wordId]=x.res;seen[x.wordId]=true});var ids=Object.keys(seen),good=ids.filter(function(idv){return lastBy[idv]==='good'}).length,bad=ids.filter(function(idv){return lastBy[idv]==='bad'}).length,uniq=ids.length,missIds=ids.filter(function(idv){return lastBy[idv]==='bad'}),miss=S.words.filter(function(w){return missIds.indexOf(w.id)>=0&&!w.ret});ts.active=false;$('type').innerHTML='<div class="card typeFinish"><div class="small">本轮完成</div><h2 style="font-size:28px;margin:7px 0">'+esc(ts.label||'手打强化')+'</h2><div class="finishStats"><div class="finishBox"><b>'+uniq+'</b><span>练过的词</span></div><div class="finishBox"><b class="ok">'+good+'</b><span>最终熟悉</span></div><div class="finishBox"><b class="miss">'+bad+'</b><span>最终不熟</span></div></div><div class="small">跳过手打直接看答案 '+(ts.skipped||0)+' 次</div><div class="row" style="justify-content:center;margin-top:20px">'+(miss.length?'<button id="redoBad" class="primary">再练本轮不熟 · '+miss.length+'</button>':'')+'<button id="chooseAgain" class="soft">重新选一组</button></div></div>';if($('redoBad'))$('redoBad').onclick=function(){startTypeQueue(miss,'本轮不熟再练')};$('chooseAgain').onclick=function(){ts=null;typeLanding()}}
function typeCard()'''
s=s[:m.start()]+typefinish+s[m.end():]

# In hand-writing mode, changing a prior judgment must recompute the word schedule from history.
if "function typeJudge(r){var w=ts.q[ts.i],m=ts.meta[ts.i];" not in s:
    raise SystemExit('exact hand attempt binding missing')

p.write_text(s,encoding='utf-8')
print('patched retry synchronization and final-status summaries')
