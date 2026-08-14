from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'data-calendar-month-v3' in s:
    print('calendar month v3 already present')
    raise SystemExit(0)

css=r'''
/* data-calendar-month-v3 */
.calendarBar{display:grid;grid-template-columns:44px 1fr 44px;gap:8px;align-items:center;margin-top:14px}.calendarBar button{height:40px;border:1px solid var(--line);background:#fffaf2;border-radius:12px;font-size:20px}.calendarMonth{text-align:center}.calendarMonth b{display:block;font-size:18px}.calendarMonth span{font-size:11px;color:var(--muted)}.heat.blank{visibility:hidden}.calendarToday{display:flex;justify-content:center;margin-top:10px}.calendarToday button{border:0;background:transparent;color:var(--muted);font-size:12px;padding:5px 10px}.heat.otherMonth{opacity:.32}.heat.future{opacity:.25}
'''
s=s.replace('</style>',css+'</style>',1)

old="var statRange=30,statDay=null;"
new="var statRange=30,statDay=null,statMonth=null;"
if old not in s: raise SystemExit('stats globals not found')
s=s.replace(old,new,1)

old_block="""  var activity={};
  S.events.forEach(function(e){activity[e.date]=(activity[e.date]||0)+1});
  var base=statDateObj(day()),dow=(base.getDay()+6)%7;base.setDate(base.getDate()-dow-28);
  var heat=[],mx=1;
  for(var hi=0;hi<35;hi++){var hd=new Date(base);hd.setDate(base.getDate()+hi);var hk=statKey(hd),hc=activity[hk]||0;if(hc>mx)mx=hc;heat.push({k:hk,n:hc,d:hd})}
  var heatHtml='<div class=\"card statSection\"><div class=\"heatTitle\"><div><b>学习日历</b><div class=\"small\">点日期看具体单词</div></div><div class=\"small\">手打 '+typed+'</div></div>'
    +'<div class=\"heatHead\"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class=\"heatGrid\">'
    +heat.map(function(x){var op=x.n?(.16+.58*x.n/mx):.05,fu=x.k>day();return'<button class=\"heat '+(x.k===statDay?'sel ':'')+(fu?'future':'')+'\" data-stat-day=\"'+x.k+'\" '+(fu?'disabled':'')+' style=\"background:rgba(93,119,99,'+op.toFixed(2)+')\"><span>'+x.d.getDate()+'</span>'+(x.n?'<b>'+x.n+'</b>':'')+'</button>'}).join('')+'</div></div>';
"""
new_block="""  var activity={};
  S.events.forEach(function(e){activity[e.date]=(activity[e.date]||0)+1});
  if(!statMonth){var sm=statDateObj(statDay||day());statMonth=new Date(sm.getFullYear(),sm.getMonth(),1)}
  var monthStart=new Date(statMonth.getFullYear(),statMonth.getMonth(),1),monthEnd=new Date(statMonth.getFullYear(),statMonth.getMonth()+1,0),offset=(monthStart.getDay()+6)%7,gridStart=new Date(monthStart);gridStart.setDate(monthStart.getDate()-offset);var gridEnd=new Date(monthEnd),tail=(7-((monthEnd.getDay()+6)%7)-1);gridEnd.setDate(monthEnd.getDate()+tail);var heat=[],mx=1,hd=new Date(gridStart);while(hd<=gridEnd){var hk=statKey(hd),hc=activity[hk]||0;if(hc>mx)mx=hc;heat.push({k:hk,n:hc,d:new Date(hd),same:hd.getMonth()===monthStart.getMonth()});hd.setDate(hd.getDate()+1)}
  var monthLabel=monthStart.getFullYear()+' 年 '+(monthStart.getMonth()+1)+' 月';
  var heatHtml='<div class=\"card statSection\"><div class=\"heatTitle\"><div><b>学习日历</b><div class=\"small\">可一直翻看历史月份，点日期看当天具体记录</div></div><div class=\"small\">本区间手打 '+typed+'</div></div>'
    +'<div class=\"calendarBar\"><button id=\"calPrev\" aria-label=\"上个月\">‹</button><div class=\"calendarMonth\"><b>'+monthLabel+'</b><span>'+Object.keys(activity).length+' 个有记录的日期</span></div><button id=\"calNext\" aria-label=\"下个月\">›</button></div>'
    +'<div class=\"heatHead\"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class=\"heatGrid\">'
    +heat.map(function(x){var op=x.n?(.16+.58*x.n/mx):.05,fu=x.k>day(),other=!x.same;return'<button class=\"heat '+(x.k===statDay?'sel ':'')+(fu?'future ':'')+(other?'otherMonth':'')+'\" data-stat-day=\"'+x.k+'\" '+(fu?'disabled':'')+' style=\"background:rgba(93,119,99,'+op.toFixed(2)+')\"><span>'+x.d.getDate()+'</span>'+(x.n?'<b>'+x.n+'</b>':'')+'</button>'}).join('')+'</div><div class=\"calendarToday\"><button id=\"calToday\">回到本月</button></div></div>';
"""
if old_block not in s: raise SystemExit('calendar block not found')
s=s.replace(old_block,new_block,1)

old_handlers="""  document.querySelectorAll('[data-stat-day]').forEach(function(b){b.onclick=function(){statDay=this.dataset.statDay;stats()}});
"""
new_handlers="""  document.querySelectorAll('[data-stat-day]').forEach(function(b){b.onclick=function(){statDay=this.dataset.statDay;var sd=statDateObj(statDay);statMonth=new Date(sd.getFullYear(),sd.getMonth(),1);stats()}});
  if($('calPrev'))$('calPrev').onclick=function(){statMonth=new Date(statMonth.getFullYear(),statMonth.getMonth()-1,1);stats()};
  if($('calNext'))$('calNext').onclick=function(){var nx=new Date(statMonth.getFullYear(),statMonth.getMonth()+1,1),nowm=new Date();nowm=new Date(nowm.getFullYear(),nowm.getMonth(),1);if(nx<=nowm){statMonth=nx;stats()}};
  if($('calToday'))$('calToday').onclick=function(){var n=new Date();statMonth=new Date(n.getFullYear(),n.getMonth(),1);statDay=day();stats()};
"""
if old_handlers not in s: raise SystemExit('calendar handlers not found')
s=s.replace(old_handlers,new_handlers,1)

p.write_text(s,encoding='utf-8')
print('patched full month calendar navigation')
