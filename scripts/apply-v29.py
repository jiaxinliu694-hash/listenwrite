from pathlib import Path

p=Path('src/app.js')
s=p.read_text()
s=s.replace(
    "import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textCollectionSummaries } from './textlibrary.js';",
    "import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textCollectionUnfamiliarTokens, textCollectionSummaries } from './textlibrary.js';",
)
old="""function renderTextCollection(){
  const name=textLibraryCollection||'未分类';
  const texts=[...state.texts].filter(t=>(t.collection||'未分类')===name).sort((a,b)=>(b.lastOpened||b.updatedAt||0)-(a.lastOpened||a.updatedAt||0));
  shell(`<div class=\"stack\"><section class=\"card\"><div class=\"space\"><div><button id=\"backTextLibraries\" class=\"ghost\">‹ 文本库</button><h2 class=\"section-title\">${esc(name)}</h2><div class=\"small\">${texts.length} 篇文本</div></div><button id=\"newTextInCollection\" class=\"primary\">新建文本</button></div></section>"""
new="""function renderTextCollection(){
  const name=textLibraryCollection||'未分类';
  const texts=[...state.texts].filter(t=>(t.collection||'未分类')===name).sort((a,b)=>(b.lastOpened||b.updatedAt||0)-(a.lastOpened||a.updatedAt||0));
  const collectionUnfamiliar=textCollectionUnfamiliarTokens(state,name);
  shell(`<div class=\"stack\"><section class=\"card\"><div class=\"space\"><div><button id=\"backTextLibraries\" class=\"ghost\">‹ 文本库</button><h2 class=\"section-title\">${esc(name)}</h2><div class=\"small\">${texts.length} 篇文本 · 整库不熟悉 ${collectionUnfamiliar.length} 词</div></div><div class=\"toolbar\"><button id=\"exportCollectionUnfamiliar\" class=\"soft\" ${collectionUnfamiliar.length?'':'disabled'}>导出整库不熟悉 · ${collectionUnfamiliar.length}</button><button id=\"newTextInCollection\" class=\"primary\">新建文本</button></div></div></section>"""
if old not in s:
    raise SystemExit('renderTextCollection header marker missing')
s=s.replace(old,new,1)
old="""  document.getElementById('backTextLibraries').onclick=()=>{textLibraryCollection=null;renderText();};
  document.getElementById('newTextInCollection').onclick=()=>{textToolsOpen=true;textFormOpen=true;textEditId=null;renderText();setTimeout(()=>{const el=document.getElementById('textCollection');if(el)el.value=name;},0);};
"""
new="""  document.getElementById('backTextLibraries').onclick=()=>{textLibraryCollection=null;renderText();};
  document.getElementById('exportCollectionUnfamiliar').onclick=()=>{if(!collectionUnfamiliar.length)return;const safe=String(name||'文本库').replace(/[\\/:*?\"<>|]+/g,'-');download(`${safe}-整库不熟悉-${currentDayKey()}.tsv`,problemTokensToTSV(collectionUnfamiliar,{source:`${name} · 整库不熟悉`}),'text/tab-separated-values;charset=utf-8');toast(`已导出整库 ${collectionUnfamiliar.length} 个不熟悉词`);};
  document.getElementById('newTextInCollection').onclick=()=>{textToolsOpen=true;textFormOpen=true;textEditId=null;renderText();setTimeout(()=>{const el=document.getElementById('textCollection');if(el)el.value=name;},0);};
"""
if old not in s:
    raise SystemExit('collection binding marker missing')
s=s.replace(old,new,1)
s=s.replace('>导出不熟悉 · ${unfamiliar.length}</button>', '>导出本篇不熟悉 · ${unfamiliar.length}</button>')
p.write_text(s)

ip=Path('index.html')
html=ip.read_text().replace('app.bundle.js?v=28-export-unfamiliar','app.bundle.js?v=29-collection-unfamiliar')
ip.write_text(html)

for test_path in ['tests/v23_1.test.js','tests/v24.test.js']:
    tp=Path(test_path)
    tt=tp.read_text().replace("app.bundle.js?v=28", "app.bundle.js?v=29")
    tp.write_text(tt)

v=Path('tests/v27.test.js')
t=v.read_text().replace(
    "import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textCollectionSummaries } from '../src/textlibrary.js';",
    "import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textCollectionUnfamiliarTokens, textCollectionSummaries } from '../src/textlibrary.js';",
)
if "collection-level unfamiliar export" not in t:
    t += """\n\ntest('collection-level unfamiliar export merges all texts in the book and de-duplicates words',()=>{\n  const state={texts:[{id:'t1',collection:'剑18'},{id:'t2',collection:'剑18'},{id:'t3',collection:'剑19'}],words:[],simpleWords:[],sentenceBooks:[{id:'b',entries:[\n    {id:'e1',sourceTextId:'t1',text:'Rural areas.',tokens:[{surface:'Rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:1}]}]},\n    {id:'e2',sourceTextId:'t2',text:'Rural residents commute.',tokens:[{surface:'Rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:2}]},{surface:'commute',normalized:'commute',status:'unfamiliar',attempts:[{ts:2}]}]},\n    {id:'e3',sourceTextId:'t3',text:'Remote work.',tokens:[{surface:'Remote',normalized:'remote',status:'unfamiliar',attempts:[{ts:3}]}]}\n  ]}]};\n  const tokens=textCollectionUnfamiliarTokens(state,'剑18');\n  assert.deepEqual(tokens.map(x=>x.normalized),['commute','rural']);\n  assert.equal(tokens.find(x=>x.normalized==='rural').sourceTextIds.length,2);\n});\n"""
v.write_text(t)
