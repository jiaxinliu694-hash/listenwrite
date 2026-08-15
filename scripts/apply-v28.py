from pathlib import Path

p=Path('src/app.js')
s=p.read_text()
s=s.replace(
    "import { linkedTextEntries, textPracticeWords, textCollectionSummaries } from './textlibrary.js';",
    "import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textCollectionSummaries } from './textlibrary.js';",
)
old="""  const sentences=linkedTextEntries(state,t.id,{practicedOnly:true});const words=textPracticeWords(state,t.id);\n  shell(`<div class=\"stack\"><section class=\"card\"><button id=\"backTextCollection\" class=\"ghost\">‹ ${esc(t.collection||'未分类')}</button><h2 class=\"section-title\" style=\"margin-top:8px\">${esc(t.title)}</h2><div class=\"small\">学习记录只显示这篇文本产生并实际练过的句子和单词。</div><div class=\"grid3\" style=\"margin-top:14px\"><div class=\"statbox\"><b>${sentences.length}</b><span>听过的句子</span></div><div class=\"statbox\"><b>${words.length}</b><span>听过的单词</span></div><div class=\"statbox\"><b>${words.filter(w=>w.simple).length}</b><span>标记简单</span></div></div><div class=\"toolbar\" style=\"margin-top:12px\"><button id=\"continueText\" class=\"primary\">继续听文本</button></div></section>"""
new="""  const sentences=linkedTextEntries(state,t.id,{practicedOnly:true});const words=textPracticeWords(state,t.id);const unfamiliar=textUnfamiliarTokens(state,t.id);\n  shell(`<div class=\"stack\"><section class=\"card\"><button id=\"backTextCollection\" class=\"ghost\">‹ ${esc(t.collection||'未分类')}</button><h2 class=\"section-title\" style=\"margin-top:8px\">${esc(t.title)}</h2><div class=\"small\">学习记录只显示这篇文本产生并实际练过的句子和单词。</div><div class=\"grid3\" style=\"margin-top:14px\"><div class=\"statbox\"><b>${sentences.length}</b><span>听过的句子</span></div><div class=\"statbox\"><b>${words.length}</b><span>听过的单词</span></div><div class=\"statbox\"><b>${words.filter(w=>w.simple).length}</b><span>标记简单</span></div></div><div class=\"toolbar\" style=\"margin-top:12px\"><button id=\"continueText\" class=\"primary\">继续听文本</button><button id=\"exportTextUnfamiliar\" class=\"soft\" ${unfamiliar.length?'':'disabled'}>导出不熟悉 · ${unfamiliar.length}</button></div></section>"""
if old not in s:
    raise SystemExit('detail header marker missing')
s=s.replace(old,new,1)
old="""  document.getElementById('continueText').onclick=()=>{textReaderId=t.id;t.lastOpened=Date.now();persist();renderTextReader();};\n"""
new="""  document.getElementById('continueText').onclick=()=>{textReaderId=t.id;t.lastOpened=Date.now();persist();renderTextReader();};\n  document.getElementById('exportTextUnfamiliar').onclick=()=>{if(!unfamiliar.length)return;const source=`${t.collection||'未分类'} · ${t.title} · 不熟悉`;const safe=String(t.title||'文本').replace(/[\\/:*?\"<>|]+/g,'-');download(`${safe}-不熟悉-${currentDayKey()}.tsv`,problemTokensToTSV(unfamiliar,{source}),'text/tab-separated-values;charset=utf-8');toast(`已导出 ${unfamiliar.length} 个不熟悉词`);};\n"""
if old not in s:
    raise SystemExit('continue binding marker missing')
s=s.replace(old,new,1)
p.write_text(s)

ip=Path('index.html')
html=ip.read_text().replace('app.bundle.js?v=27-text-library','app.bundle.js?v=28-export-unfamiliar')
ip.write_text(html)

v=Path('tests/v27.test.js')
t=v.read_text()
t=t.replace(
    "import { linkedTextEntries, textPracticeWords, textCollectionSummaries } from '../src/textlibrary.js';",
    "import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textCollectionSummaries } from '../src/textlibrary.js';",
)
if "text-specific unfamiliar export" not in t:
    t += """\n\ntest('text-specific unfamiliar export de-duplicates weak words and excludes simple words',()=>{\n  const state={texts:[{id:'t1',title:'A',collection:'剑18'}],words:[],simpleWords:['areas'],sentenceBooks:[{id:'b1',entries:[{id:'e1',sourceTextId:'t1',text:'Rural areas rural.',tokens:[{surface:'Rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:10}]},{surface:'areas',normalized:'areas',status:'unfamiliar',attempts:[{ts:11}]},{surface:'rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:12}]}]}]}]};\n  const tokens=textUnfamiliarTokens(state,'t1');\n  assert.equal(tokens.length,1);\n  assert.equal(tokens[0].normalized,'rural');\n  assert.equal(tokens[0].occurrences.length,2);\n});\n"""
v.write_text(t)
