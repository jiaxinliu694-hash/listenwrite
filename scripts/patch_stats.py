from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

if 'data-stats-v2' in s:
    print('stats v2 already present')
    raise SystemExit(0)

css = r'''
/* data-stats-v2 */
.statsTabs{display:flex;gap:8px;margin-bottom:14px}.statsTabs button{border:1px solid var(--line);background:#fffaf2;border-radius:999px;padding:8px 13px}.statsTabs button.on{background:var(--ink);color:white}.statsGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.statBox{background:rgba(255,253,249,.92);border:1px solid rgba(90,80,65,.12);border-radius:18px;padding:15px}.statBox .num{font-size:28px;font-weight:730;margin-top:4px}.statLabel{font-size:12px;color:var(--muted)}.heatTitle{display:flex;justify-content:space-between;gap:10px;align-items:center}.heatHead,.heatGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.heatHead{margin-top:14px;color:var(--muted);font-size:11px;text-align:center}.heat{aspect-ratio:1/1;border:1px solid rgba(100,90,75,.1);border-radius:10px;background:#eee9df;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:2px;font-size:11px}.heat b{font-size:12px}.heat.sel{outline:2px solid #60675e;outline-offset:1px}.heat.future{opacity:.3}.dueRow{display:grid;grid-template-columns:46px 1fr 34px;gap:9px;align-items:center;margin:10px 0;font-size:13px}.dueTrack{height:9px;border-radius:999px;background:#ece7dd;overflow:hidden}.dueFill{height:100%;border-radius:999px;background:#7d8f80}.dayRows{display:grid;gap:8px;margin-top:10px}.dayRow{display:grid;grid-template-columns:minmax(95px,1.2fr) 86px 62px 90px;gap:8px;align-items:center;border-bottom:1px solid rgba(80,75,65,.09);padding:10px 0;font-size:13px}.dayRow b{font-size:16px}.ok{color:var(--g)}.miss{color:var(--r)}.hardList{display:grid;gap:8px}.hardItem{border-bottom:1px solid rgba(80,75,65,.09);padding:10px 0}.hardTop{display:flex;justify-content:space-between;gap:12px}.hardWord{font-size:18px;font-weight:700}.hardMeta{font-size:12px;color:var(--muted);margin-top:4px}.history{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.hist{font-size:11px;padding:3px 6px;border-radius:999px;background:#eee9df}.hist.bad{background:var(--rb);color:var(--r)}.hist.good{background:var(--gb);color:var(--g)}.statsNote{font-size:12px;color:var(--muted);line-height:1.55;margin-top:8px}.statSection{margin-top:14px}
@media(max-width:560px){.statsGrid{grid-template-columns:1fr 1fr}.dayRow{grid-template-columns:1fr 76px}.dayRow .hideMobile{display:none}.heat{border-radius:8px;font-size:10px}.hardTop{align-items:flex-start;flex-direction:column}}
'''

if '</style>' not in s:
    raise SystemExit('style closing tag not found')
s = s.replace('</style>', css + '</style>', 1)

js = r'''
var statRange=30,statDay=null;
function statDateObj(x){var p=x.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function statKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function statPct(a,b){return b?Math.round(a*100/b)+'%':'—'}
function statDue(ts){if(!ts)return'未安排';var k=statKey(new Date(ts)),t=day();if(k===t)return'今天';var a=statDateObj(t),b=statDateObj(k),n=Math.round((b-a)/86400000);if(n===1)return'明天';if(n>1&&n<31)return n+'天后';if(n<0)return'已到期';return k.slice(5)}
function statEventsForRange(){if(!statRange)return S.events.slice();var st=new Date();st.setHours(0,0,0,0);st.setDate(st.getDate()-(statRange-1));return S.events.filter(function(e){return e.ts>=st.getTime()})}
function statWordEvents(id){return S.events.filter(function(e){return e.wordId===id}).sort(function(a,b){return a.ts-b.ts})}
stats=function(){
  if(!statDay)statDay=day();
  var E=statEventsForRange();
  var cold=E.filter(function(e){return e.cold});
  var coldGood=cold.filter(function(e){return e.res==='good'}).length;
  var bad=E.filter(function(e){return e.res==='bad'}).length;
  var typed=E.filter(function(e){return e.mode==='type'}).length;
  var uniq=new Set(E.map(function(e){return e.wordId})).size;
  var now=Date.now();
  var dueNow=S.words.filter(function(w){return!w.ret&&w.next&&w.next<=now}).length;

  var tabs='<div class="statsTabs"><button data-range="7" class="'+(statRange===7?'on':'')+'">7天</button><button data-range="30" class="'+(statRange===30?'on':'')+'">30天</button><button data-range="0" class="'+(!statRange?'on':'')+'">全部</button></div>';
  var summary='<div class="statsGrid">'
    +'<div class="statBox"><div class="statLabel">首轮熟悉率</div><div class="num">'+statPct(coldGood,cold.length)+'</div><div class="small">'+coldGood+' / '+cold.length+'</div></div>'
    +'<div class="statBox"><div class="statLabel">学习词数</div><div class="num">'+uniq+'</div><div class="small">本区间去重</div></div>'
    +'<div class="statBox"><div class="statLabel">不熟次数</div><div class="num">'+bad+'</div><div class="small">含当天循环</div></div>'
    +'<div class="statBox"><div class="statLabel">当前到期</div><div class="num">'+dueNow+'</div><div class="small">应该复习</div></div>'
    +'</div><div class="statsNote">“首轮熟悉率”只看每天第一次遇到某个词时的判断；当天为了学会它而重复出现的结果不重复计入这个比例。</div>';

  var activity={};
  S.events.forEach(function(e){activity[e.date]=(activity[e.date]||0)+1});
  var base=statDateObj(day()),dow=(base.getDay()+6)%7;base.setDate(base.getDate()-dow-28);
  var heat=[],mx=1;
  for(var hi=0;hi<35;hi++){var hd=new Date(base);hd.setDate(base.getDate()+hi);var hk=statKey(hd),hc=activity[hk]||0;if(hc>mx)mx=hc;heat.push({k:hk,n:hc,d:hd})}
  var heatHtml='<div class="card statSection"><div class="heatTitle"><div><b>学习日历</b><div class="small">点日期看具体单词</div></div><div class="small">手打 '+typed+'</div></div>'
    +'<div class="heatHead"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="heatGrid">'
    +heat.map(function(x){var op=x.n?(.16+.58*x.n/mx):.05,fu=x.k>day();return'<button class="heat '+(x.k===statDay?'sel ':'')+(fu?'future':'')+'" data-stat-day="'+x.k+'" '+(fu?'disabled':'')+' style="background:rgba(93,119,99,'+op.toFixed(2)+')"><span>'+x.d.getDate()+'</span>'+(x.n?'<b>'+x.n+'</b>':'')+'</button>'}).join('')+'</div></div>';

  var dayE=S.events.filter(function(e){return e.date===statDay}).sort(function(a,b){return a.ts-b.ts});
  var groups={};dayE.forEach(function(e){(groups[e.wordId]||(groups[e.wordId]=[])).push(e)});
  var dayRows=Object.keys(groups).map(function(id){var a=groups[id],w=S.words.find(function(x){return x.id===id}),first=a[0],fails=a.filter(function(e){return e.res==='bad'}).length,listen=a.filter(function(e){return e.mode==='listen'}).length,type=a.filter(function(e){return e.mode==='type'}).length;return{w:w,a:a,first:first,fails:fails,listen:listen,type:type}}).sort(function(a,b){return b.fails-a.fails||(a.w?a.w.en:'').localeCompare(b.w?b.w.en:'')});
  var dayCold=dayE.filter(function(e){return e.cold}),dayGood=dayCold.filter(function(e){return e.res==='good'}).length;
  var detail='<div class="card statSection"><div class="heatTitle"><div><b>'+statDay+' 详情</b><div class="small">首轮熟悉 '+statPct(dayGood,dayCold.length)+' · 判断 '+dayE.length+' 次 · '+dayRows.length+' 个词</div></div>'+(dayRows.some(function(x){return x.fails})?'<button id="dayPractice" class="soft">手打当天不熟</button>':'')+'</div><div class="dayRows">'
    +(dayRows.length?dayRows.map(function(x){var w=x.w||{en:'已删除词',src:[]};return'<div class="dayRow"><div><b>'+esc(w.en)+'</b><div class="small">'+((w.src||[]).slice(0,2).map(function(z){return esc(z)}).join(' · ')||'')+'</div></div><div class="'+(x.first.res==='good'?'ok':'miss')+'">首轮'+(x.first.res==='good'?'熟悉':'不熟')+'</div><div class="hideMobile">不熟 '+x.fails+'</div><div class="hideMobile">听 '+x.listen+' · 写 '+x.type+'</div></div>'}).join(''):'<div class="small" style="padding:18px 0">这一天还没有学习记录。</div>')+'</div></div>';

  var due=[],todayD=statDateObj(day());
  for(var di=0;di<7;di++){var dd=new Date(todayD);dd.setDate(dd.getDate()+di);due.push({k:statKey(dd),label:di===0?'今天':(di===1?'明天':(dd.getMonth()+1)+'/'+dd.getDate()),n:0})}
  S.words.filter(function(w){return!w.ret&&w.next}).forEach(function(w){var k=statKey(new Date(w.next));if(w.next<todayD.getTime())due[0].n++;else{var q=due.find(function(x){return x.k===k});if(q)q.n++}});
  var dueMax=Math.max.apply(null,due.map(function(x){return x.n}).concat([1]));
  var forecast='<div class="card statSection"><b>未来 7 天复习量</b><div class="small">按当前调度估算</div>'+due.map(function(x){return'<div class="dueRow"><span>'+x.label+'</span><div class="dueTrack"><div class="dueFill" style="width:'+(x.n/dueMax*100)+'%"></div></div><b>'+x.n+'</b></div>'}).join('')+'</div>';

  var wg={};
  E.forEach(function(e){if(!wg[e.wordId])wg[e.wordId]={bad:0,coldBad:0};if(e.res==='bad'){wg[e.wordId].bad++;if(e.cold)wg[e.wordId].coldBad++}});
  var hard=Object.keys(wg).map(function(id){var g=wg[id],w=S.words.find(function(x){return x.id===id});return{w:w,g:g,score:g.coldBad*4+(g.bad-g.coldBad)}}).filter(function(x){return x.w&&x.g.bad}).sort(function(a,b){return b.score-a.score||b.g.bad-a.g.bad}).slice(0,12);
  var hardHtml='<div class="card statSection"><div class="heatTitle"><div><b>困难词</b><div class="small">优先看“隔天再次想不起来”的词</div></div>'+(hard.length?'<button id="hardPractice" class="soft">手打这批</button>':'')+'</div><div class="hardList">'
    +(hard.length?hard.map(function(x){var h=statWordEvents(x.w.id).slice(-8);return'<div class="hardItem"><div class="hardTop"><div><div class="hardWord">'+esc(x.w.en)+'</div><div class="hardMeta">首轮不熟 '+x.g.coldBad+' 次 · 总不熟 '+x.g.bad+' 次 · 下次 '+statDue(x.w.next)+'</div></div><div>'+esc(x.w.zh||'')+'</div></div><div class="history">'+h.map(function(e){return'<span class="hist '+e.res+'">'+e.date.slice(5)+' '+(e.mode==='type'?'写':'听')+' '+(e.res==='good'?'熟':'不熟')+'</span>'}).join('')+'</div></div>'}).join(''):'<div class="small" style="padding:18px 0">这个区间没有不熟记录。</div>')+'</div></div>';

  $('stats').innerHTML=tabs+summary+heatHtml+detail+forecast+hardHtml;
  document.querySelectorAll('[data-range]').forEach(function(b){b.onclick=function(){statRange=+this.dataset.range;stats()}});
  document.querySelectorAll('[data-stat-day]').forEach(function(b){b.onclick=function(){statDay=this.dataset.statDay;stats()}});
  if($('dayPractice'))$('dayPractice').onclick=function(){var q=dayRows.filter(function(x){return x.fails&&x.w&&!x.w.ret}).map(function(x){return x.w});ts={active:true,q:q,i:0,show:false,res:null,input:''};go('type');if(q[0])speak(q[0].en)};
  if($('hardPractice'))$('hardPractice').onclick=function(){var q=hard.map(function(x){return x.w}).filter(function(w){return!w.ret});ts={active:true,q:q,i:0,show:false,res:null,input:''};go('type');if(q[0])speak(q[0].en)};
};
'''

marker = 'load();nav();home();})();'
if marker not in s:
    raise SystemExit('script end marker not found')
s = s.replace(marker, js + marker, 1)
p.write_text(s, encoding='utf-8')
print('patched statistics v2')
