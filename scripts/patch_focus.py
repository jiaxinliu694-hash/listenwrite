from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

if 'data-focus-study' in s:
    print('focus study mode already present')
    raise SystemExit(0)

css = r'''
/* data-focus-study */
.focusStudy .top,.focusStudy .nav{display:none!important}
.focusStudy .wrap{max-width:none;padding:0!important}
.focusStudy #study{display:block;min-height:100dvh}
.focusStudy .study{min-height:100dvh;border:0;border-radius:0;box-shadow:none;background:var(--bg);padding:118px 24px 120px}
.focusStudy .count{display:none}
.focusTop{position:absolute;top:0;left:0;right:0;height:92px;padding:max(16px,env(safe-area-inset-top)) 20px 0;display:flex;align-items:center;justify-content:center;z-index:3}
.focusBack{position:absolute;left:16px;top:max(14px,env(safe-area-inset-top));width:48px;height:48px;border:0;background:transparent;border-radius:50%;font-size:40px;font-weight:300;line-height:40px;color:var(--ink);padding:0}
.focusBack:active{background:rgba(70,65,55,.08)}
.focusProgress{font-size:14px;color:var(--muted);letter-spacing:.03em}
.focusStudy .retire{top:max(24px,calc(env(safe-area-inset-top) + 10px));right:20px;z-index:4}
@media(max-width:560px){.focusStudy .study{padding-left:20px;padding-right:20px}.focusTop{height:88px}}
'''
s = s.replace('</style>', css + '</style>', 1)

old = "function go(v){cur=v;document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on')});"
new = "function go(v){document.body.classList.remove('focusStudy');cur=v;document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on')});"
if old not in s:
    raise SystemExit('go() target not found')
s = s.replace(old, new, 1)

old = "sess={q:q,i:0,show:false,res:null};cur='study';document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on')});"
new = "sess={q:q,i:0,show:false,res:null};document.body.classList.add('focusStudy');cur='study';document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on')});"
if old not in s:
    raise SystemExit('start() target not found')
s = s.replace(old, new, 1)

old = "$('study').innerHTML='<div class=\"card study\"><div class=\"count\">'+(sess.i+1)+' / '+sess.q.length+'</div><button id=\"ret\" class=\"retire\">退出循环</button>"
new = "$('study').innerHTML='<div class=\"card study\"><div class=\"focusTop\"><button id=\"focusBack\" class=\"focusBack\" aria-label=\"返回首页\">‹</button><div class=\"focusProgress\">'+(sess.i+1)+' / '+sess.q.length+'</div></div><div class=\"count\">'+(sess.i+1)+' / '+sess.q.length+'</div><button id=\"ret\" class=\"retire\">退出循环</button>"
if old not in s:
    raise SystemExit('study markup target not found')
s = s.replace(old, new, 1)

old = "$('sp').onclick=function(){speak(w.en)};$('good').onclick=function(){judge('good')};"
new = "$('focusBack').onclick=function(){go('home')};$('sp').onclick=function(){speak(w.en)};$('good').onclick=function(){judge('good')};"
if old not in s:
    raise SystemExit('study handlers target not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('patched immersive study mode')
