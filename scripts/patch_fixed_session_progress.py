from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'data-fixed-session-progress-v1' in s:
    print('fixed session progress already present')
    raise SystemExit(0)

s=s.replace('</style>','/* data-fixed-session-progress-v1 */\n.focusProgress{white-space:nowrap}\n</style>',1)

start_block=r'''function start(){ensureActivities();var books=selectedBooks('today'),df=dueAndFresh(books),r=df.due.slice(),f=df.fresh.slice();r.sort(function(a,b){return(b.diff||0)-(a.diff||0)||(a.next||0)-(b.next||0)});f.sort(function(a,b){return(b.src.length-a.src.length)});var reviewQ=r.slice(0,S.set.reviewN),newQ=f.slice(0,S.set.newN),q=reviewQ.concat(newQ);if(!q.length){toast('当前词书范围今天没有待学习词');return}var kindById={};reviewQ.forEach(function(w){kindById[w.id]='review'});newQ.forEach(function(w){kindById[w.id]='new'});sess={q:q,i:0,show:false,res:null,books:books.slice(),activityId:startActivity('listen',books,'今日听音'),totals:{new:newQ.length,review:reviewQ.length},done:{new:0,review:0},doneIds:{},kindById:kindById,attempts:{},meta:{}};document.body.classList.add('focusStudy');cur='study';document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on')});$('study').classList.add('on');$('ey').textContent='听音';$('title').textContent='今日学习';nav();study();if(q[0])setTimeout(function(){speak(q[0].en)},60)}
function cw(){return sess&&sess.q[sess.i]}
function sessionKind(w){return sess&&sess.kindById&&sess.kindById[w.id]||'review'}
function sessionMarkDone(w){if(!sess.doneIds[w.id]){sess.doneIds[w.id]=true;var k=sessionKind(w);sess.done[k]=(sess.done[k]||0)+1}}
function sessionUnmarkDone(w){if(sess.doneIds[w.id]){delete sess.doneIds[w.id];var k=sessionKind(w);sess.done[k]=Math.max(0,(sess.done[k]||0)-1)}}
function sessionHasFuture(w){for(var j=sess.i+1;j<sess.q.length;j++)if(sess.q[j].id===w.id)return true;return false}
function sessionAdvancePastDone(){while(sess&&sess.i<sess.q.length&&sess.doneIds[sess.q[sess.i].id])sess.i++}
function sessionProgress(){var w=cw(),m=w&&sess.meta[sess.i],attempt=m?m.attemptNo:((w&&sess.attempts[w.id])||0)+1,extra=attempt>1?' · 本词第 '+attempt+' 次':'';return'新词 '+(sess.done.new||0)+' / '+(sess.totals.new||0)+'　复习 '+(sess.done.review||0)+' / '+(sess.totals.review||0)+extra}
function rebuildWordSchedule(w){var a=S.events.filter(function(e){return e.wordId===w.id}).sort(function(x,y){return x.ts-y.ts}),intr=0,diff=0,nextAt=0;a.forEach(function(e){if(e.cold){if(e.res==='bad'){intr=1;diff+=1}else{intr=intr?Math.min(180,Math.max(2,Math.round(intr*2.1))):3;diff=Math.max(0,diff-.1)}nextAt=e.ts+intr*86400000}else if(e.res==='bad')diff+=.15});w.int=intr;w.diff=diff;w.next=nextAt}
function study(){var w=cw();if(!w){if(sess&&sess.activityId)endActivity(sess.activityId);$('study').innerHTML='<div class="card" style="text-align:center;padding:45px">这轮结束了<br><br><div class="small">新词 '+(sess.done.new||0)+' / '+(sess.totals.new||0)+' · 复习 '+(sess.done.review||0)+' / '+(sess.totals.review||0)+'</div><br><button id="back" class="primary">回到今日</button></div>';$('back').onclick=function(){go('today')};return}var mid=sess.show?'<div><div class="word '+(sess.res==='good'?'good':'bad')+'">'+esc(w.en)+'</div><div class="mean">'+esc(w.zh||'暂无中文释义')+'</div><div class="meta">'+esc(w.pos||'')+(w.def?' · '+esc(w.def):'')+'</div>'+(w.ex.length?'<div class="ex">'+esc(w.ex[w.ex.length-1])+'</div>':'')+((w.src||[]).length?'<div class="answerBooks">'+w.src.map(function(b){return'<span class="answerBook">'+esc(b)+'</span>'}).join('')+'</div>':'')+'</div>':'<div class="small">听到以后，意思能不能直接出来？</div>';$('study').innerHTML='<div class="card study"><div class="focusTop"><button id="focusBack" class="focusBack" aria-label="返回今日">‹</button><div class="focusProgress">'+sessionProgress()+'</div></div><div class="count">'+sessionProgress()+'</div><button id="ret" class="retire">退出循环</button><button id="sp" class="speaker">◖))</button>'+mid+'<div class="judge"><button id="good" class="goodb">1　熟悉</button><button id="bad" class="badb">2　不熟悉</button></div><div class="hint">'+(sess.show?'再点 1/2 可修改；只有最终熟悉才增加完成数':'本轮新词/复习分母固定，不会因为重试变大')+'</div>'+(sess.show?'<div class="mobileMove"><button id="prev" class="soft" '+(sess.i===0?'disabled':'')+'>上一词</button><button id="nxt" class="primary">下一词</button></div>':'')+'</div>';$('focusBack').onclick=function(){if(sess&&sess.activityId)endActivity(sess.activityId);go('today')};$('sp').onclick=function(){speak(w.en)};$('good').onclick=function(){judge('good')};$('bad').onclick=function(){judge('bad')};$('ret').onclick=function(){w.ret=true;save();next(true)};if(sess.show){if($('prev'))$('prev').onclick=prev;if($('nxt'))$('nxt').onclick=function(){next(false)}}}
function judge(r){var w=cw(),idx=sess.i,m=sess.meta[idx];if(!sess.show){var no=(sess.attempts[w.id]||0)+1;sess.attempts[w.id]=no;ev(w,'listen',r);m={eventId:S.events[S.events.length-1].id,res:r,attemptNo:no};sess.meta[idx]=m;sess.show=true;sess.res=r;if(sess.activityId)touchActivity(sess.activityId)}else if(sess.res!==r){m=sess.meta[idx];if(m){var e=S.events.find(function(x){return x.id===m.eventId});if(e)e.res=r;m.res=r;rebuildWordSchedule(w);save()}sess.res=r}study()}
function next(skip){var w=cw();if(!w)return;if(skip){sessionMarkDone(w)}else if(sess.res==='good'){sessionMarkDone(w)}else if(sess.res==='bad'){sessionUnmarkDone(w);if(!sessionHasFuture(w))sess.q.push(w)}else{return}sess.i++;sess.show=false;sess.res=null;sessionAdvancePastDone();study();var n=cw();if(n)setTimeout(function(){speak(n.en)},60)}
function prev(){if(!sess||sess.i<=0)return;sess.i--;var w=cw(),m=sess.meta[sess.i];sess.show=!!m;sess.res=m?m.res:null;study()}
function typeBooks()'''

pat=r'function start\(\)\{.*?function typeBooks\(\)'
s2,n=re.subn(pat,lambda m:start_block,s,count=1,flags=re.S)
if n!=1: raise SystemExit('could not replace listening session block')
s=s2

# Hand mode uses a fixed unique denominator as well; repeated failures may extend the internal attempt queue but never the displayed total.
s=s.replace("ts={active:true,q:q,i:0,show:false,res:null,input:'',label:label||'手打强化',done:[],skipped:0,books:bs.slice(),activityId:startActivity('type',bs,label||'手打强化')}","ts={active:true,q:q,i:0,show:false,res:null,input:'',label:label||'手打强化',done:[],skipped:0,books:bs.slice(),activityId:startActivity('type',bs,label||'手打强化'),fixedTotal:q.length,completed:{}}",1)
s=s.replace("(ts.i+1)+' / '+ts.q.length+' · '+esc(ts.label||'手打强化')","Object.keys(ts.completed||{}).length+' / '+(ts.fixedTotal||ts.q.length)+' · '+esc(ts.label||'手打强化')",1)
old="function typeNext(){if(!ts||!ts.show||!ts.res)return;var w=ts.q[ts.i];if(ts.res==='bad')ts.q.push(w);ts.i++;ts.show=false;ts.res=null;ts.input='';typeCard();var n=ts.q[ts.i];if(n)setTimeout(function(){speak(n.en)},60)}"
new="function typeNext(){if(!ts||!ts.show||!ts.res)return;var w=ts.q[ts.i];if(ts.res==='bad'){delete ts.completed[w.id];ts.q.push(w)}else ts.completed[w.id]=true;ts.i++;while(ts.i<ts.q.length&&ts.completed[ts.q[ts.i].id])ts.i++;ts.show=false;ts.res=null;ts.input='';typeCard();var n=ts.q[ts.i];if(n)setTimeout(function(){speak(n.en)},60)}"
if old not in s: raise SystemExit('hand typeNext target not found')
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('fixed session denominators and completion accounting')
