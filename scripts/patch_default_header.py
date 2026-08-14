from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('<div id="ey" class="ey">今日</div><h1 id="title">学习</h1>','<div id="ey" class="ey">首页</div><h1 id="title">听词</h1>',1)
p.write_text(s,encoding='utf-8')
print('fixed default header')
