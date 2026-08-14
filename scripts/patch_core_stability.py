from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'data-core-stability-v1' in s:
    print('core stability v1 already present')
    raise SystemExit(0)

s=s.replace('</style>','/* data-core-stability-v1 */\n</style>',1)

old="function ensureActivities(){if(!Array.isArray(S.activities))S.activities=[];if(!S.set)S.set={newN:30,reviewN:80,rate:.92};if(!Array.isArray(S.set.todayBooks))S.set.todayBooks=[];if(!Array.isArray(S.set.typeBooks))S.set.typeBooks=[]}"
new="function ensureActivities(){if(!Array.isArray(S.activities))S.activities=[];if(!S.set)S.set={newN:30,reviewN:80,rate:.92};if(!Array.isArray(S.set.todayBooks))S.set.todayBooks=[];if(!Array.isArray(S.set.typeBooks))S.set.typeBooks=[];if(!S.dailyPlans||typeof S.dailyPlans!=='object'||Array.isArray(S.dailyPlans))S.dailyPlans={}}"
if old not in s: raise SystemExit('ensureActivities target not found')
s=s.replace(old,new,1)

# Replace daily data helpers so Today is listening-only, while hand-writing remains separate.
pat=r"function firstEverTs\(wordId\)\{.*?\}\nfunction todayScopeData\(books\)\{.*?\}\nfunction startActivity"
m=re.search(pat,s,re.S)
if not m: raise SystemExit('todayScopeData block not found')
helpers=r'''function firstEverTs(wordId){var a=S.events.filter(function(e){return e.wordId===wordId}).sort(function(a,b){return a.ts-b.ts});return a.length?a[0].ts:0}
function localDateKey(ts){var d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function wordMatchesBooks(w,books){books=books||[];return!books.length||(w.src||[]).some(function(b){return books.indexOf(b)>=0})}
function scopeWordIdsAll(books){return new Set(S.words.filter(function(w){return wordMatchesBooks(w,books)}).map(function(w){return w.id}))}
function todayListenEvents(wordId){var d=day();return S.events.filter(function(e){return e.wordId===wordId&&e.date===d&&e.mode==='listen'}).sort(function(a,b){return a.ts-b.ts})}
function latestTodayEvent(wordId){var d=day(),a=S.events.filter(function(e){return e.wordId===wordId&&e.date===d}).sort(function(a,b){return a.ts-b.ts});return a.length?a[a.length-1]:null}
function hadEventBeforeToday(wordId){var d=day();return S.events.some(function(e){return e.wordId===wordId&&e.date<d})}
function todayScopeData(books){var ids=scopeWordIdsAll(books),d=day(),todayEvents=S.events.filter(function(e){return e.date===d&&e.mode==='listen'&&ids.has(e.wordId)}),wordIds=[...new Set(todayEvents.map(function(e){return e.wordId}))],newIds=[],reviewIds=[],firsts=[];wordIds.forEach(function(idv){if(hadEventBeforeToday(idv))reviewIds.push(idv);else newIds.push(idv);var a=todayEvents.filter(function(e){return e.wordId===idv}).sort(function(a,b){return a.ts-b.ts});if(a[0])firsts.push(a[0])});return{events:todayEvents,newIds:newIds,reviewIds:reviewIds,firstGood:firsts.filter(function(e){return e.res==='good'}).length,firstBad:firsts.filter(function(e){return e.res==='bad'}).length}}
function dailyPlanKey(books){return day()+'::'+((books||[]).slice().sort().join('|')||'__all__')}
function getDailyPlan(books){ensureActivities();var key=dailyPlanKey(books),p=S.dailyPlans[key];if(!p)p=S.dailyPlans[key]={date:day(),books:(books||[]).slice().sort(),newIds:[],reviewIds:[]};var exists=new Set(S.words.map(function(w){return w.id}));p.newIds=(p.newIds||[]).filter(function(idv){return exists.has(idv)});p.reviewIds=(p.reviewIds||[]).filter(function(idv){return exists.has(idv)});var known=new Set(p.newIds.concat(p.reviewIds)),td=todayScopeData(books);td.newIds.forEach(function(idv){if(!known.has(idv)){p.newIds.push(idv);known.add(idv)}});td.reviewIds.forEach(function(idv){if(!known.has(idv)){p.reviewIds.push(idv);known.add(idv)}});save();return p}
function allAssignedToday(){ensureActivities();var d=day(),out=new Set();Object.keys(S.dailyPlans).forEach(function(k){var p=S.dailyPlans[k];if(p&&p.date===d)(p.newIds||[]).concat(p.reviewIds||[]).forEach(function(idv){out.add(idv)})});return out}
function dailyPlanStatus(p){var done=[],retry=[],pending=[],doneSet={};(p.newIds||[]).concat(p.reviewIds||[]).forEach(function(idv){var w=S.words.find(function(x){return x.id===idv});if(!w)return;var le=latestTodayEvent(idv),listened=todayListenEvents(idv).length>0;if(w.ret||(listened&&le&&le.res==='good')){done.push(w);doneSet[idv]=true}else if(listened&&le&&le.res==='bad')retry.push(w);else pending.push(w)});return{done:done,retry:retry,pending:pending,doneSet:doneSet}}
function extendDailyPlan(p,books){var assigned=allAssignedToday(),pool=wordsInBooks(books),needNew=Math.max(0,(+S.set.newN||0)-p.newIds.length),needReview=Math.max(0,(+S.set.reviewN||0)-p.reviewIds.length),fresh=pool.filter(function(w){return!assigned.has(w.id)&&!S.events.some(function(e){return e.wordId===w.id})}),now=Date.now(),review=pool.filter(function(w){return!assigned.has(w.id)&&S.events.some(function(e){return e.wordId===w.id})&&(w.next||0)<=now});fresh.sort(function(a,b){return(b.src.length-a.src.length)||a.en.localeCompare(b.en)});review.sort(function(a,b){return(b.diff||0)-(a.diff||0)||(a.next||0)-(b.next||0)});fresh.slice(0,needNew).forEach(function(w){p.newIds.push(w.id);assigned.add(w.id)});review.slice(0,needReview).forEach(function(w){p.reviewIds.push(w.id);assigned.add(w.id)});save();return p}
function startActivity'''
s=s[:m.start()]+helpers+s[m.end():]

# Exclude already-assigned daily-plan words from availability previews.
old="function dueAndFresh(books){var pool=wordsInBooks(books),seen=new Set(S.events.map(function(e){return e.wordId})),now=Date.now();return{pool:pool,due:pool.filter(function(w){return seen.has(w.id)&&(w.next||0)<=now}),fresh:pool.filter(function(w){return!seen.has(w.id)})}}"
new="function dueAndFresh(books){var pool=wordsInBooks(books),seen=new Set(S.events.map(function(e){return e.wordId})),assigned=allAssignedToday(),now=Date.now();return{pool:pool,due:pool.filter(function(w){return!assigned.has(w.id)&&seen.has(w.id)&&(w.next||0)<=now}),fresh:pool.filter(function(w){return!assigned.has(w.id)&&!seen.has(w.id)})}}"
if old not in s: raise SystemExit('dueAndFresh target not found')
s=s.replace(old,new,1)

# Replace Today page so assigned, completed, remaining and availability are different concepts.
pat=r"function todayView\(\)\{.*?\}\nfunction start\(\)"
m=re.search(pat,s,re.S)
if not m: raise SystemExit('todayView block not found')
today=r'''function todayView(){ensureActivities();var books=selectedBooks('today'),p=getDailyPlan(books),ps=dailyPlanStatus(p),df=dueAndFresh(books),td=todayScopeData(books),mins=activityMinutes('listen',books),bookList=books.length?books:allBooks(),newDone=ps.done.filter(function(w){return p.newIds.indexOf(w.id)>=0}).length,reviewDone=ps.done.filter(function(w){return p.reviewIds.indexOf(w.id)>=0}).length;$('today').innerHTML='<div class="card"><div class="textHead"><div><h2 style="margin:0 0 5px">今日学习</h2><div class="small">先选今天要学的词书；可多选，重复词只出现一次。</div></div><span class="collectionBadge">'+(books.length?books.length+' 本':'全部')+'</span></div>'+bookPicker('today')+'</div><div class="todayStats" style="margin-top:14px"><div class="todayStat"><b>'+td.newIds.length+'</b><span>今日听音新词</span></div><div class="todayStat"><b>'+td.reviewIds.length+'</b><span>今日听音复习</span></div><div class="todayStat"><b>'+td.firstGood+'</b><span>听音首轮熟悉</span></div><div class="todayStat"><b>'+mins+'m</b><span>听音用时</span></div></div><div class="card" style="margin-top:14px"><div class="heatTitle"><div><b>今天的学习计划</b><div class="small">新词和复习是固定任务数；同一个词重试多少次都不会增加分母。</div></div></div><div class="planGrid"><div class="planBox"><div class="small">新词目标</div><div class="big">'+S.set.newN+'</div><div class="sub">已安排 '+p.newIds.length+' · 已完成 '+newDone+' · 可再选 '+df.fresh.length+'</div></div><div class="planBox"><div class="small">复习目标</div><div class="big">'+S.set.reviewN+'</div><div class="sub">已安排 '+p.reviewIds.length+' · 已完成 '+reviewDone+' · 当前可选 '+df.due.length+'</div></div></div><div class="planControls"><div class="field"><label>今日新词目标</label><input id="todayNewN" type="number" min="0" value="'+S.set.newN+'"></div><div class="field"><label>今日复习目标</label><input id="todayRevN" type="number" min="0" value="'+S.set.reviewN+'"></div></div><div class="row" style="margin-top:16px"><button id="todayStart" class="primary">'+((p.newIds.length||p.reviewIds.length)?'继续今日听音':'开始今日听音')+'</button><span class="small">未完成 '+(ps.pending.length+ps.retry.length)+' 个，其中当天重试 '+ps.retry.length+' 个</span></div></div><div class="card" style="margin-top:14px"><div><b>各词书今天的听音情况</b><div class="small">这里不混入手打数据；手打页只显示手打自己的数据。</div></div><div class="bookDailyList">'+(bookList.length?bookList.map(function(b){var x=todayScopeData([b]),count=wordsInBooks([b]).length;return'<div class="bookDailyRow"><div class="bookDailyTop"><b>'+esc(b)+'</b><span class="small">'+count+' 词</span></div><div class="bookDailyNums"><div class="bookDailyNum"><strong>'+x.newIds.length+'</strong>听音新词</div><div class="bookDailyNum"><strong>'+x.reviewIds.length+'</strong>听音复习</div><div class="bookDailyNum"><strong class="ok">'+x.firstGood+'</strong>首轮熟悉</div><div class="bookDailyNum"><strong class="miss">'+x.firstBad+'</strong>首轮不熟</div></div></div>'}).join(''):'<div class="small">还没有词书，先去词库导入。</div>')+'</div></div>';bindBookPicker('today',todayView);$('todayNewN').onchange=function(){S.set.newN=Math.max(0,+this.value||0);save();todayView()};$('todayRevN').onchange=function(){S.set.reviewN=Math.max(0,+this.value||0);save();todayView()};$('todayStart').onclick=start}
function start()'''
s=s[:m.start()]+today+s[m.end():]

# Replace start only. The retry-pool state machine below remains responsible for current-session transitions.
pat=r"function start\(\)\{.*?\}\nfunction cw\(\)"
m=re.search(pat,s,re.S)
if not m: raise SystemExit('start block not found')
start=r'''function start(){ensureActivities();var books=selectedBooks('today'),p=extendDailyPlan(getDailyPlan(books),books),ps=dailyPlanStatus(p),kindById={},wordById={};S.words.forEach(function(w){wordById[w.id]=w});p.reviewIds.forEach(function(idv){kindById[idv]='review'});p.newIds.forEach(function(idv){kindById[idv]='new'});var qReview=ps.pending.filter(function(w){return kindById[w.id]==='review'}),qNew=ps.pending.filter(function(w){return kindById[w.id]==='new'}),q=qReview.concat(qNew),retry=ps.retry.slice(),attempts={};p.newIds.concat(p.reviewIds).forEach(function(idv){attempts[idv]=todayListenEvents(idv).length});var doneIds={},done={new:0,review:0};ps.done.forEach(function(w){doneIds[w.id]=true;var k=kindById[w.id]||'review';done[k]++});var totals={new:p.newIds.length,review:p.reviewIds.length};if(!q.length&&!retry.length){toast((totals.new||totals.review)?'今天这个词书范围的计划已经完成':'当前词书范围没有可学习的词');todayView();return}sess={q:q,i:0,retry:retry,inRetry:!q.length,show:false,res:null,books:books.slice(),planKey:dailyPlanKey(books),activityId:startActivity('listen',books,'今日听音'),totals:totals,done:done,doneIds:doneIds,kindById:kindById,attempts:attempts,meta:{},currentMeta:null};document.body.classList.add('focusStudy');cur='study';document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on')});$('study').classList.add('on');$('ey').textContent='听音';$('title').textContent='今日学习';nav();study();if(cw())setTimeout(function(){speak(cw().en)},60)}
function cw()'''
s=s[:m.start()]+start+s[m.end():]

# Hand-writing: bind each judgment to the exact attempt/event instead of "last event for this word today".
s=s.replace("ts={active:true,q:q,i:0,show:false,res:null,input:'',label:label||'手打强化',done:[],skipped:0,books:bs.slice(),activityId:startActivity('type',bs,label||'手打强化'),fixedTotal:q.length,completed:{}}","ts={active:true,q:q,i:0,show:false,res:null,input:'',label:label||'手打强化',done:[],skipped:0,books:bs.slice(),activityId:startActivity('type',bs,label||'手打强化'),fixedTotal:q.length,completed:{},meta:{},inputByIndex:{}}",1)

s=s.replace("function reveal(skip){ts.input=$('ti').value.trim();if(skip||!ts.input)ts.skipped=(ts.skipped||0)+1;ts.show=true;typeCard()}","function reveal(skip){ts.input=$('ti').value.trim();ts.inputByIndex[ts.i]=ts.input;if(skip||!ts.input)ts.skipped=(ts.skipped||0)+1;ts.show=true;typeCard()}",1)

pat=r"function typeJudge\(r\)\{.*?\}\nfunction typeNext\(\)"
m=re.search(pat,s,re.S)
if not m: raise SystemExit('typeJudge block not found')
typejudge=r'''function typeJudge(r){var w=ts.q[ts.i],m=ts.meta[ts.i];if(!m){ev(w,'type',r);if(ts.activityId)touchActivity(ts.activityId);m={eventId:S.events[S.events.length-1].id,res:r};ts.meta[ts.i]=m;ts.done.push({eventId:m.eventId,wordId:w.id,res:r,ts:Date.now()})}else if(m.res!==r){var e=S.events.find(function(x){return x.id===m.eventId});if(e)e.res=r;m.res=r;var h=ts.done.find(function(x){return x.eventId===m.eventId});if(h)h.res=r;rebuildWordSchedule(w);save()}ts.res=r;typeCard()}
function typeNext()'''
s=s[:m.start()]+typejudge+s[m.end():]

old="function typePrev(){if(!ts||ts.i<=0)return;ts.i--;var w=ts.q[ts.i],a=S.events.filter(function(e){return e.wordId===w.id&&e.date===day()&&e.mode==='type'}),last=a.length?a[a.length-1]:null;ts.show=true;ts.res=last?last.res:null;ts.input='';typeCard()}"
new="function typePrev(){if(!ts||ts.i<=0)return;ts.i--;var m=ts.meta[ts.i];ts.show=true;ts.res=m?m.res:null;ts.input=(ts.inputByIndex&&ts.inputByIndex[ts.i])||'';typeCard()}"
if old not in s: raise SystemExit('typePrev target not found')
s=s.replace(old,new,1)

# End-of-hand summary: "unresolved" means the last judgment for that word is bad, not merely that it failed once earlier.
oldfrag="missIds=[...new Set(a.filter(function(x){return x.res==='bad'}).map(function(x){return x.wordId}))],miss=S.words.filter(function(w){return missIds.indexOf(w.id)>=0&&!w.ret})"
newfrag="lastBy={};a.forEach(function(x){lastBy[x.wordId]=x.res});var missIds=Object.keys(lastBy).filter(function(idv){return lastBy[idv]==='bad'}),miss=S.words.filter(function(w){return missIds.indexOf(w.id)>=0&&!w.ret})"
if oldfrag not in s: raise SystemExit('typeFinish unresolved target not found')
s=s.replace(oldfrag,newfrag,1)

p.write_text(s,encoding='utf-8')
print('patched core stability: daily plans, mode separation, exact attempt edits')
