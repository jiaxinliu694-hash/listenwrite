from pathlib import Path
import re

p = Path('src/app.js')
s = p.read_text()

new_home = r'''function renderHome() {
  const today = todayListeningStats(state, [], currentDayKey());
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>今天</h2><p>首页只留今日完成小计和入口。</p></div><button id="goToday" class="primary">进入今日学习</button></div><div class="grid2" style="margin-top:16px"><div class="statbox"><b>${today.newCount}</b><span>今日新词完成</span></div><div class="statbox"><b>${today.reviewCount}</b><span>今日复习完成</span></div></div></section><div class="grid2"><button id="homeToday" class="entry"><b>今日学习</b><span>继续新词、复习和当天待巩固。</span></button><button id="goType" class="entry"><b>手打强化</b><span>按日期、词书和不熟次数筛选强化。</span></button><button id="goText" class="entry"><b>文本与句子</b><span>文本库、句子拆词听写和句子错词。</span></button><button id="goStats" class="entry"><b>学习统计</b><span>日历、首轮结果、困难词和复习预测。</span></button></div></div>`);
  document.getElementById('goToday').onclick = () => go('today');
  document.getElementById('homeToday').onclick = () => go('today');
  document.getElementById('goType').onclick = () => go('type');
  document.getElementById('goText').onclick = () => go('text');
  document.getElementById('goStats').onclick = () => go('stats');
}'''

s2, n = re.subn(r'function renderHome\(\) \{.*?\n\}\n\nfunction renderToday', lambda _m: new_home + '\n\nfunction renderToday', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'renderHome finalization failed: {n}')
p.write_text(s2)
print('finalized v7 home')
