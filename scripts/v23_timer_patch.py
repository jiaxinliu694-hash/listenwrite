from pathlib import Path

def patch(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'missing pattern in {path}: {old[:80]}')
    p.write_text(s.replace(old,new,1))

patch('src/storage.js', "import { normalizeTexts } from './textsentences.js';", "import { normalizeTexts } from './textsentences.js';\nimport { normalizeActivities } from './activity.js';")
start="function normalizeActivities(list, preserveDate) {\n  return (Array.isArray(list) ? list : []).map((a) => ({\n    ...a,\n    date: preserveDate && a.date ? a.date : calendarDayKey(Number(a.start) || Number(a.lastTouch) || Date.now()),\n  }));\n}\n"
patch('src/storage.js', start, '')
patch('src/storage.js', "state.activities = normalizeActivities(input?.activities, preserveDates);", "state.activities = normalizeActivities(input?.activities, preserveDates, calendarDayKey);")

app=Path('src/app.js'); s=app.read_text()
s=s.replace("import { ensureSentenceBooks, ensureSimpleWords, isSimpleLexeme, markSimpleLexeme, addSentenceEntry, getSentenceEntry, deleteSentenceEntry, deleteSentenceBook, recordSentenceToken, setSentenceTokenStatus, sentencePracticeIndexes, sentenceProblemTokens, allSentenceProblemTokens, findSentenceProblemEntries, sentenceSourceLabel, problemTokensToTSV, deriveSentencePracticeStatus, deriveWholeSentenceStatus, deriveSplitSentenceStatus, setSentencePracticeStatus, setSplitSentencePracticeStatus, recordWholeSentenceAttempt } from './sentencebooks.js';", "import { ensureSentenceBooks, ensureSimpleWords, isSimpleLexeme, markSimpleLexeme, addSentenceEntry, getSentenceEntry, deleteSentenceEntry, deleteSentenceBook, recordSentenceToken, setSentenceTokenStatus, sentencePracticeIndexes, sentenceProblemTokens, allSentenceProblemTokens, findSentenceProblemEntries, sentenceSourceLabel, problemTokensToTSV, deriveSentencePracticeStatus, deriveWholeSentenceStatus, deriveSplitSentenceStatus, setSentencePracticeStatus, setSplitSentencePracticeStatus, recordWholeSentenceAttempt } from './sentencebooks.js';\nimport { startStudyActivity, setStudyActivityDate, flushStudyActivity, pauseStudyActivity, resumeStudyActivity, finishStudyActivity, studyActivityElapsedMs, activityMinutes as activityMinutesFromState, activityTotalMs, formatStudyTime } from './activity.js';")
s=s.replace("let sentenceDraftTimer = null;", "let sentenceDraftTimer = null;\nlet studyTimerInterval = null;")
old="""function startActivity(mode, label, books = []) {
  const a = { id: uid('act'), mode, label, books: [...books], date: currentDayKey(), start: Date.now(), lastTouch: Date.now(), activeMs: 0 };
  state.activities.push(a); persist(); return a.id;
}
function touchActivity(id) {
  const a = state.activities.find((x) => x.id === id); if (!a) return;
  const now = Date.now(); const last = a.lastTouch || a.start || now;
  a.activeMs = (a.activeMs || 0) + Math.max(0, Math.min(now - last, 90000)); a.lastTouch = now; persist();
}
function activityMinutes(mode = null, date = currentDayKey()) {
  const list = state.activities.filter((a) => a.date === date && (!mode || a.mode === mode));
  const ms = list.reduce((sum, a) => sum + (a.activeMs || Math.max(0, (a.end || a.start) - a.start) || 0), 0);
  return ms ? Math.max(1, Math.round(ms / 60000)) : 0;
}
"""
new="""function startActivity(mode, label, books = []) {
  const id=startStudyActivity(state,mode,label,books);setStudyActivityDate(state,id,currentDayKey());persist();return id;
}
function touchActivity(id) { if(!id)return;flushStudyActivity(state,id);persist(); }
function finishActivity(id){if(!id)return;finishStudyActivity(state,id);persist();}
function activityMinutes(mode = null, date = currentDayKey()) { return activityMinutesFromState(state,mode,date); }
function activeStudyActivityId(){return listen?.activityId||typeRun?.activityId||wholeSentenceRun?.activityId||sentenceRun?.activityId||freeListen?.activityId||null;}
function mountStudyTimer(activityId){
  clearInterval(studyTimerInterval);studyTimerInterval=null;if(!activityId)return;
  let badge=document.getElementById('studyTimer');if(!badge){badge=document.createElement('div');badge.id='studyTimer';badge.className='study-timer';document.querySelector('.immersive')?.appendChild(badge);}
  const draw=()=>{const el=document.getElementById('studyTimer');if(el)el.textContent='本轮 '+formatStudyTime(studyActivityElapsedMs(state,activityId,Date.now(),!document.hidden));};draw();studyTimerInterval=setInterval(draw,1000);
}
"""
if old not in s: raise SystemExit('activity block missing')
s=s.replace(old,new,1)
# listen render: mount after templates using stable handler lines
s=s.replace("document.getElementById('bufferNext').onclick=()=>{finishCurrent(listen.session,'buffer');touchActivity(listen.activityId);advanceListen();};\n    return;", "document.getElementById('bufferNext').onclick=()=>{finishCurrent(listen.session,'buffer');touchActivity(listen.activityId);advanceListen();};mountStudyTimer(listen.activityId);\n    return;")
s=s.replace("document.getElementById('judgeGood').onclick = () => judgeListen('good'); document.getElementById('judgeBad').onclick = () => judgeListen('bad');", "mountStudyTimer(listen.activityId); document.getElementById('judgeGood').onclick = () => judgeListen('good'); document.getElementById('judgeBad').onclick = () => judgeListen('bad');")
s=s.replace("document.getElementById('finishListen').onclick = () => { listen = null; view = 'today'; renderToday(); };", "mountStudyTimer(listen.activityId); document.getElementById('finishListen').onclick = () => { finishActivity(listen.activityId); listen = null; view = 'today'; renderToday(); };")
# type render mounts in buffer and regular
s=s.replace("document.getElementById('typeBufferNext').onclick=()=>{finishCurrent(typeRun.session,'buffer');if(!pickNext(typeRun.session))finishType();else{renderTypeRun();speak(wordById(typeRun.session.current.wordId).en);}};return;", "document.getElementById('typeBufferNext').onclick=()=>{finishCurrent(typeRun.session,'buffer');if(!pickNext(typeRun.session))finishType();else{renderTypeRun();speak(wordById(typeRun.session.current.wordId).en);}};mountStudyTimer(typeRun.activityId);return;")
s=s.replace("document.getElementById('typeBack').onclick = () => { touchActivity(typeRun.activityId); typeRun=null; view='type'; renderType(); };", "mountStudyTimer(typeRun.activityId); document.getElementById('typeBack').onclick = () => { finishActivity(typeRun.activityId); typeRun=null; view='type'; renderType(); };")
s=s.replace("document.getElementById('finishType').onclick=()=>{typeRun=null;view='type';renderType();};", "mountStudyTimer(typeRun.activityId);document.getElementById('finishType').onclick=()=>{finishActivity(typeRun.activityId);typeRun=null;view='type';renderType();};")
# whole sentence activity across sequence
s=s.replace("wholeSentenceRun={bookId,entryId,returnTextId,input:'',alignment:null,revealed:false,peek:false};sentenceRun=null;persist();", "const priorActivity=preserveQueue?wholeSentenceRun?.activityId:null;wholeSentenceRun={bookId,entryId,returnTextId,input:'',alignment:null,revealed:false,peek:false,activityId:priorActivity||startActivity('sentence','整句听写',[])};sentenceRun=null;persist();")
s=s.replace("function continueWholeSequence(run){if(wholeQueue.length){const next=wholeQueue.shift();wholeSentenceRun=null;startWholeSentenceEntry(next.bookId,next.entryId,{returnTextId:run?.returnTextId||null,preserveQueue:true});return;}returnFromWholeSentenceRun(run);}", "function continueWholeSequence(run){if(wholeQueue.length){const next=wholeQueue.shift();const activityId=run?.activityId||null;wholeSentenceRun={activityId};startWholeSentenceEntry(next.bookId,next.entryId,{returnTextId:run?.returnTextId||null,preserveQueue:true});return;}returnFromWholeSentenceRun(run);}")
s=s.replace("function returnFromWholeSentenceRun(run){wholeSentenceRun=null;wholeQueue=[];persist();", "function returnFromWholeSentenceRun(run){finishActivity(run?.activityId);wholeSentenceRun=null;wholeQueue=[];persist();")
s=s.replace("document.getElementById('wholeBack').onclick=()=>returnFromWholeSentenceRun(run);", "mountStudyTimer(run.activityId);document.getElementById('wholeBack').onclick=()=>returnFromWholeSentenceRun(run);")
# split
s=s.replace("sentenceRun={items:[...items],cursor:0,label,input:'',result:null,revealed:false,lookups:0,correct:0,returnTextId,skippedSimple,completed:false};", "sentenceRun={items:[...items],cursor:0,label,input:'',result:null,revealed:false,lookups:0,correct:0,returnTextId,skippedSimple,completed:false,activityId:startActivity('sentence','拆词听写',[])};")
s=s.replace("function returnFromSentenceRun(run){sentenceRun=null;persist();", "function returnFromSentenceRun(run){finishActivity(run?.activityId);sentenceRun=null;persist();")
s=s.replace("document.getElementById('sentenceBack').onclick=()=>{persist();const run=sentenceRun;returnFromSentenceRun(run);};", "mountStudyTimer(sentenceRun.activityId);document.getElementById('sentenceBack').onclick=()=>{persist();const run=sentenceRun;returnFromSentenceRun(run);};")
# finish split page timer
s=s.replace("document.getElementById('finishSentence').onclick=()=>returnFromSentenceRun(run);}", "mountStudyTimer(run.activityId);document.getElementById('finishSentence').onclick=()=>returnFromSentenceRun(run);}")
# free listen timer
s=s.replace("freeListen={book,ids,index,scope,limit:Number(limit)||0,revealed:false,result:null,bad:[]};", "freeListen={book,ids,index,scope,limit:Number(limit)||0,revealed:false,result:null,bad:[],activityId:startActivity('free',`自由听 · ${book}`,[book])};")
s=s.replace("freeListen={book:label,ids,index:0,scope:'batch',limit:ids.length,revealed:false,result:null,bad:[],batch:true};", "freeListen={book:label,ids,index:0,scope:'batch',limit:ids.length,revealed:false,result:null,bad:[],batch:true,activityId:startActivity('free',label,[])};")
s=s.replace("document.getElementById('freeBack').onclick=()=>{saveFreeProgress();freeListen=null;view='library';renderLibrary();};", "mountStudyTimer(freeListen.activityId);document.getElementById('freeBack').onclick=()=>{finishActivity(freeListen.activityId);saveFreeProgress();freeListen=null;view='library';renderLibrary();};")
s=s.replace("function finishFreeListen(){if(!freeListen)return;const run=freeListen;", "function finishFreeListen(){if(!freeListen)return;const run=freeListen;finishActivity(run.activityId);")
# stats show total visible duration
needle="function renderStats(){const E=filteredEvents(),cold=E.filter(e=>e.cold),good=cold.filter(e=>e.result==='good').length,listenCold=cold.filter(e=>e.mode==='listen'),typeCold=cold.filter(e=>e.mode==='type'),uniq=new Set(E.map(e=>e.wordId)).size,forecast=dueForecast(state,7);shell(`"
replacement="function renderStats(){const E=filteredEvents(),cold=E.filter(e=>e.cold),good=cold.filter(e=>e.result==='good').length,listenCold=cold.filter(e=>e.mode==='listen'),typeCold=cold.filter(e=>e.mode==='type'),uniq=new Set(E.map(e=>e.wordId)).size,forecast=dueForecast(state,7),totalStudy=formatStudyTime(activityTotalMs(state,{date:statDay}));shell(`<section class=\"card\"><div class=\"space\"><div><h2 class=\"section-title\">${statDay} 学习时长</h2><div class=\"small\">听词、手打、整句、拆词和自由听统一累计</div></div><b style=\"font-size:28px\">${totalStudy}</b></div></section>"
if needle not in s: raise SystemExit('stats needle missing')
s=s.replace(needle,replacement,1)
# visibility: pause/resume and persist
old="document.addEventListener('visibilitychange',()=>{if(document.hidden&&(wholeSentenceRun||sentenceRun)){const wholeInput=document.getElementById('wholeSentenceAnswer');if(wholeSentenceRun&&wholeInput)wholeSentenceRun.input=wholeInput.value;const splitInput=document.getElementById('sentenceAnswer');if(sentenceRun&&splitInput)sentenceRun.input=splitInput.value;persist();}});"
new="document.addEventListener('visibilitychange',()=>{const activityId=activeStudyActivityId();if(document.hidden){if(activityId)pauseStudyActivity(state,activityId);const wholeInput=document.getElementById('wholeSentenceAnswer');if(wholeSentenceRun&&wholeInput)wholeSentenceRun.input=wholeInput.value;const splitInput=document.getElementById('sentenceAnswer');if(sentenceRun&&splitInput)sentenceRun.input=splitInput.value;persist();}else if(activityId){resumeStudyActivity(state,activityId);persist();mountStudyTimer(activityId);}});"
if old not in s: raise SystemExit('visibility missing')
s=s.replace(old,new,1)
app.write_text(s)

css=Path('styles.css'); cs=css.read_text(); cs += "\n.study-timer{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:45;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,253,249,.96);box-shadow:0 8px 26px rgba(58,51,40,.12);font-variant-numeric:tabular-nums;font-size:12px;font-weight:700;color:var(--ink)}\n"
css.write_text(cs)

Path('tests/v23.test.js').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { startStudyActivity, setStudyActivityDate, flushStudyActivity, pauseStudyActivity, resumeStudyActivity, finishStudyActivity, studyActivityElapsedMs, activityTotalMs, formatStudyTime, normalizeActivities } from '../src/activity.js';

test('study timer accumulates only active visible spans',()=>{const s={activities:[]};const id=startStudyActivity(s,'listen','today',[],1000);setStudyActivityDate(s,id,'2026-08-15');flushStudyActivity(s,id,11000);pauseStudyActivity(s,id,16000);assert.equal(studyActivityElapsedMs(s,id,30000,true),15000);resumeStudyActivity(s,id,40000);assert.equal(studyActivityElapsedMs(s,id,45000,true),20000);finishStudyActivity(s,id,50000);assert.equal(studyActivityElapsedMs(s,id,90000,true),25000);assert.equal(activityTotalMs(s,{date:'2026-08-15'}),25000);});

test('old activities normalize as inactive so reload does not count closed-tab time',()=>{const rows=normalizeActivities([{id:'a',mode:'listen',start:1000,lastTouch:4000,activeMs:3000,active:true}],true,()=> '2026-08-15');assert.equal(rows[0].active,false);assert.equal(rows[0].activeMs,3000);});

test('timer formatting is visible-clock friendly',()=>{assert.equal(formatStudyTime(65000),'01:05');assert.equal(formatStudyTime(3661000),'01:01:01');});
""")
print('patched')
