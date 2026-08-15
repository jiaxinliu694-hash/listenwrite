from pathlib import Path

p=Path('src/app.js')
s=p.read_text()
if "./textlibrary.js" not in s:
    s=s.replace("import { createDataChartUI } from './datachart-ui.js';", "import { createDataChartUI } from './datachart-ui.js';\nimport { linkedTextEntries, textPracticeWords, textCollectionSummaries } from './textlibrary.js';")
if "let textLibraryCollection" not in s:
    s=s.replace("let textFormOpen = false;", "let textFormOpen = false;\nlet textLibraryCollection = null;\nlet textLibraryDetailId = null;\nlet textToolsOpen = false;")
s=s.replace("function go(next) { speechSynthesis?.cancel(); view = next; listen = null; typeRun = null; sentenceRun = null; wholeSentenceRun = null; wholeQueue = []; freeListen = null; textReaderId = null; dataChartUI?.resetToHome?.(); render(); }", "function go(next) { speechSynthesis?.cancel(); view = next; listen = null; typeRun = null; sentenceRun = null; wholeSentenceRun = null; wholeQueue = []; freeListen = null; textReaderId = null; if(next!=='text'){textLibraryCollection=null;textLibraryDetailId=null;textToolsOpen=false;} dataChartUI?.resetToHome?.(); render(); }")

if 'function renderTextLegacy(){' not in s:
    s=s.replace('function renderText(){','function renderTextLegacy(){',1)

if 'function renderTextLibraryHome(){' not in s:
    marker='function renderTextReader(){'
    pos=s.find(marker)
    if pos<0: raise SystemExit('reader marker missing')
    insert=r'''
function textHistoryStatusLabel(status){return status==='simple'?'简单':status==='unfamiliar'?'不熟悉':status==='familiar'?'熟悉':'听过';}
function renderTextLibraryHome(){
  ensureSentenceBooks(state);ensureSimpleWords(state);
  const groups=textCollectionSummaries(state);
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>文本库</h2><p>先按文本库找文章；句子和单词学习记录只在对应文章里面显示。</p></div><button id="newText" class="primary">新建文本</button></div></section><section class="card"><div class="space"><div><h2 class="section-title">我的文本库</h2><div class="small">${state.texts.length} 篇文本 · ${groups.length} 个库</div></div></div><div class="list" style="margin-top:12px">${groups.length?groups.map(g=>`<button class="entry" data-text-collection="${esc(g.name)}"><div><b>${esc(g.name)}</b><div class="small" style="margin-top:6px">${g.textCount} 篇 · 已听 ${g.practicedSentenceCount} 句 · 听过 ${g.wordCount} 词${g.weakCount?` · ${g.weakCount} 个不熟悉`:''}</div></div><span>进入文本库 ›</span></button>`).join(''):'<div class="empty">还没有文本。先新建一篇。</div>'}</div></section><section class="card"><div class="space"><div><h2 class="section-title">独立句子工具</h2><div class="small">临时句子、全局句子库和错词检索放在这里，不再铺在文本主页。</div></div><button id="openSentenceTools" class="soft">进入</button></div></section></div>`);
  document.getElementById('newText').onclick=()=>{textToolsOpen=true;textFormOpen=true;textEditId=null;renderText();};
  document.getElementById('openSentenceTools').onclick=()=>{textToolsOpen=true;renderText();};
  document.querySelectorAll('[data-text-collection]').forEach(b=>b.onclick=()=>{textLibraryCollection=b.dataset.textCollection;textLibraryDetailId=null;renderText();});
}
function renderTextCollection(){
  const name=textLibraryCollection||'未分类';
  const texts=[...state.texts].filter(t=>(t.collection||'未分类')===name).sort((a,b)=>(b.lastOpened||b.updatedAt||0)-(a.lastOpened||a.updatedAt||0));
  shell(`<div class="stack"><section class="card"><div class="space"><div><button id="backTextLibraries" class="ghost">‹ 文本库</button><h2 class="section-title">${esc(name)}</h2><div class="small">${texts.length} 篇文本</div></div><button id="newTextInCollection" class="primary">新建文本</button></div></section><section class="card"><div class="list">${texts.length?texts.map(t=>{const practiced=linkedTextEntries(state,t.id,{practicedOnly:true});const words=textPracticeWords(state,t.id);return`<article class="textitem"><div class="space"><div><h3>${esc(t.title)}</h3><div class="small">${splitSentences(t.body).length} 句 · 已听 ${practiced.length} 句 · 听过 ${words.length} 词</div></div></div><p class="snippet">${esc(t.body.replace(/\s+/g,' '))}</p><div class="toolbar"><button class="primary" data-open-text="${t.id}">继续听${t.sentence?` · 第 ${t.sentence+1} 句`:''}</button><button class="soft" data-text-history="${t.id}">学习记录</button><button class="ghost" data-edit-text="${t.id}">编辑</button></div></article>`}).join(''):'<div class="empty">这个文本库还没有文章。</div>'}</div></section></div>`);
  document.getElementById('backTextLibraries').onclick=()=>{textLibraryCollection=null;renderText();};
  document.getElementById('newTextInCollection').onclick=()=>{textToolsOpen=true;textFormOpen=true;textEditId=null;renderText();setTimeout(()=>{const el=document.getElementById('textCollection');if(el)el.value=name;},0);};
  document.querySelectorAll('[data-open-text]').forEach(b=>b.onclick=()=>{textReaderId=b.dataset.openText;const t=state.texts.find(x=>x.id===textReaderId);if(t)t.lastOpened=Date.now();persist();renderTextReader();});
  document.querySelectorAll('[data-text-history]').forEach(b=>b.onclick=()=>{textLibraryDetailId=b.dataset.textHistory;renderText();});
  document.querySelectorAll('[data-edit-text]').forEach(b=>b.onclick=()=>{textEditId=b.dataset.editText;textToolsOpen=true;textFormOpen=true;renderText();});
}
function renderTextLibraryDetail(){
  const t=state.texts.find(x=>x.id===textLibraryDetailId);if(!t){textLibraryDetailId=null;return renderText();}
  const sentences=linkedTextEntries(state,t.id,{practicedOnly:true});const words=textPracticeWords(state,t.id);
  shell(`<div class="stack"><section class="card"><button id="backTextCollection" class="ghost">‹ ${esc(t.collection||'未分类')}</button><h2 class="section-title" style="margin-top:8px">${esc(t.title)}</h2><div class="small">学习记录只显示这篇文本产生并实际练过的句子和单词。</div><div class="grid3" style="margin-top:14px"><div class="statbox"><b>${sentences.length}</b><span>听过的句子</span></div><div class="statbox"><b>${words.length}</b><span>听过的单词</span></div><div class="statbox"><b>${words.filter(w=>w.simple).length}</b><span>标记简单</span></div></div><div class="toolbar" style="margin-top:12px"><button id="continueText" class="primary">继续听文本</button></div></section><section class="card"><h2 class="section-title">听过的句子</h2><div class="list" style="margin-top:12px">${sentences.length?sentences.map(({book,entry})=>{const st=sentenceStateInfo(entry);return`<div class="sentence-entry"><div class="sentence-entry-meta"><span class="sentence-state ${st.whole.status}">整句 ${st.whole.label}</span><span class="sentence-state ${st.split.status}">拆词 ${st.split.label}</span><span class="small">第 ${Number(entry.sentenceIndex||0)+1} 句</span></div><div class="sentence-entry-text">${esc(entry.text)}</div><div class="sentence-mode-row"><button class="soft" data-history-whole="${book.id}|${entry.id}">整句听写</button><button class="soft" data-history-split="${book.id}|${entry.id}">拆词听写</button></div></div>`}).join(''):'<div class="empty">这篇文本还没有练过句子。</div>'}</div></section><section class="card"><h2 class="section-title">听过的单词</h2><div class="small">“简单”是全局词状态；误标后在这里恢复，会重新出现在句子拆词和普通词库学习里。</div><div class="list" style="margin-top:12px">${words.length?words.map(w=>`<div class="listitem compact-word"><div class="space"><div><div class="word-main"><b>${esc(w.surface)}</b><span class="tag">${textHistoryStatusLabel(w.status)}</span></div><div class="small">出现 ${w.occurrences.length} 次</div></div>${w.simple?`<button class="soft" data-restore-simple="${esc(w.lexeme)}">恢复</button>`:''}</div></div>`).join(''):'<div class="empty">这篇文本还没有拆词记录。</div>'}</div></section></div>`);
  document.getElementById('backTextCollection').onclick=()=>{textLibraryDetailId=null;textLibraryCollection=t.collection||'未分类';renderText();};
  document.getElementById('continueText').onclick=()=>{textReaderId=t.id;t.lastOpened=Date.now();persist();renderTextReader();};
  document.querySelectorAll('[data-history-whole]').forEach(b=>b.onclick=()=>{const [bookId,entryId]=b.dataset.historyWhole.split('|');startWholeSentenceEntry(bookId,entryId,{returnTextId:t.id});});
  document.querySelectorAll('[data-history-split]').forEach(b=>b.onclick=()=>{const [bookId,entryId]=b.dataset.historySplit.split('|');startSavedEntryDictation(bookId,entryId,{returnTextId:t.id});});
  document.querySelectorAll('[data-restore-simple]').forEach(b=>b.onclick=()=>{markSimpleLexeme(state,b.dataset.restoreSimple,false);persist();toast('已恢复，会重新进入相关练习');renderTextLibraryDetail();});
}
function renderText(){
  if(textReaderId)return renderTextReader();
  if(textToolsOpen)return renderTextLegacy();
  if(textLibraryDetailId)return renderTextLibraryDetail();
  if(textLibraryCollection!=null)return renderTextCollection();
  return renderTextLibraryHome();
}
'''
    s=s[:pos]+insert+s[pos:]

legacy='shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>文本与句子</h2>'
if legacy in s:
    s=s.replace(legacy,'shell(`<div class="stack"><section class="card hero"><div class="space"><div><button id="backToTextLibrary" class="ghost">‹ 文本库</button><h2>独立句子工具</h2>',1)
needle="  document.getElementById('newText').onclick=()=>{textFormOpen=!textFormOpen;if(!textFormOpen)textEditId=null;renderText();};"
if "backToTextLibrary').onclick" not in s:
    if needle not in s: raise SystemExit('legacy binding marker missing')
    s=s.replace(needle,"  document.getElementById('backToTextLibrary').onclick=()=>{textToolsOpen=false;textFormOpen=false;textEditId=null;renderText();};\n"+needle,1)
p.write_text(s)

ip=Path('index.html')
html=ip.read_text().replace('app.bundle.js?v=26-sentence-controls','app.bundle.js?v=27-text-library')
ip.write_text(html)

bp=Path('tests/browser-smoke.test.js')
t=bp.read_text()
old="  document.querySelector('[data-nav=\"text\"]').click();\n  await waitFor(() => document.querySelector('#sentenceBookName'));"
new="  document.querySelector('[data-nav=\"text\"]').click();\n  await waitFor(() => document.querySelector('#openSentenceTools'));\n  assert.match(document.getElementById('app').textContent, /文本库/);\n  assert.equal(document.querySelector('#sentenceBookName'), null, 'global sentence tools should not be spread across the text-library home');\n  document.getElementById('openSentenceTools').click();\n  await waitFor(() => document.querySelector('#sentenceBookName'));"
if old in t: t=t.replace(old,new,1)
old="  await waitFor(() => document.querySelector('#newText'));\n  document.getElementById('newText').click();"
new="  await waitFor(() => document.querySelector('#backToTextLibrary'));\n  document.getElementById('backToTextLibrary').click();\n  await waitFor(() => document.querySelector('#newText'));\n  document.getElementById('newText').click();"
if old in t: t=t.replace(old,new,1)
old="  await waitFor(() => document.querySelector('[data-open-text]'));\n  document.querySelector('[data-open-text]').click();"
new="  await waitFor(() => document.querySelector('#backToTextLibrary'));\n  document.getElementById('backToTextLibrary').click();\n  await waitFor(() => document.querySelector('[data-text-collection=\"剑18\"]'));\n  document.querySelector('[data-text-collection=\"剑18\"]').click();\n  await waitFor(() => document.querySelector('[data-open-text]'));\n  assert.ok(document.querySelector('[data-text-history]'), 'each text should expose its own sentence/word history');\n  document.querySelector('[data-open-text]').click();"
if old in t: t=t.replace(old,new,1)
bp.write_text(t)

v=Path('tests/v27.test.js')
if not v.exists():
    v.write_text("""import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { markSimpleLexeme } from '../src/sentencebooks.js';\nimport { linkedTextEntries, textPracticeWords, textCollectionSummaries } from '../src/textlibrary.js';\n\ntest('text library groups texts and keeps practiced sentence/word history inside the source text',()=>{\n  const state={texts:[{id:'t1',title:'A',collection:'剑18',sentences:[{id:'s1'}],updatedAt:1}],words:[],simpleWords:[],sentenceBooks:[{id:'b1',name:'句子',entries:[{id:'e1',sourceTextId:'t1',sentenceIndex:0,text:'Rural areas.',lastPracticedAt:20,tokens:[{surface:'Rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:20}]},{surface:'areas',normalized:'areas',status:'familiar',attempts:[{ts:20}]}]}]}]};\n  assert.equal(linkedTextEntries(state,'t1',{practicedOnly:true}).length,1);\n  const words=textPracticeWords(state,'t1');assert.equal(words.length,2);assert.equal(words.find(w=>w.lexeme==='rural').status,'unfamiliar');\n  const groups=textCollectionSummaries(state);assert.equal(groups[0].name,'剑18');assert.equal(groups[0].practicedSentenceCount,1);assert.equal(groups[0].wordCount,2);\n});\n\ntest('mistaken simple mark is reversible and text history reflects the restored state',()=>{\n  const state={texts:[{id:'t1',title:'A',collection:'剑18'}],words:[{id:'w1',en:'rural',retired:false}],simpleWords:[],sentenceBooks:[{id:'b1',entries:[{id:'e1',sourceTextId:'t1',text:'Rural.',tokens:[{surface:'Rural',normalized:'rural',status:'familiar',attempts:[{ts:10}]}]}]}]};\n  markSimpleLexeme(state,'rural',true);assert.equal(textPracticeWords(state,'t1')[0].simple,true);assert.equal(state.words[0].retired,true);\n  markSimpleLexeme(state,'rural',false);assert.equal(textPracticeWords(state,'t1')[0].simple,false);assert.equal(state.words[0].retired,false);\n});\n""")
