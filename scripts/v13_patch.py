from pathlib import Path

p = Path('src/app.js')
s = p.read_text()

old = "import { updateWordFields, deleteWordEverywhere } from './wordadmin.js';"
new = old + "\nimport { freeListenCandidates, linkedSentenceSourceState, staleLinkedSentenceCount, removeStaleLinkedSentences } from './usepolish.js';"
assert old in s
s = s.replace(old, new, 1)

# Sentence source badges and stale cleanup.
old = "function sentenceStateInfo(entry){const status=deriveSentencePracticeStatus(entry);return {status,label:status==='repeat'?'需重练':status==='done'?'已通过':status==='ignored'?'忽略':'未练'};}"
new = old + "\nfunction sentenceSourceBadge(entry){const status=linkedSentenceSourceState(state,entry);const suffix=status==='source-deleted'?' · 来源已删除':status==='source-changed'?' · 原文已修改':status==='legacy-link'?' · 旧版关联':'';return `${esc(sentenceSourceLabel(entry))}${suffix?`<span class=\"tag\">${esc(suffix.trim().replace(/^·\\s*/,''))}</span>`:''}`;}"
assert old in s
s = s.replace(old, new, 1)
s = s.replace("${esc(sentenceSourceLabel(entry))}${problems.length?` · 错词 ${problems.length}`:''}", "${sentenceSourceBadge(entry)}${problems.length?` · 错词 ${problems.length}`:''}", 1)
old = "  const sentenceBookRows=state.sentenceBooks.map(sentenceLibraryBookHtml).join('');"
new = old + "\n  const staleSentenceLinks=staleLinkedSentenceCount(state);"
assert old in s
s = s.replace(old, new, 1)
old = '<div class="small">默认按“需重练 → 未练 → 已通过 → 忽略”排列。每一句都能重新做整句、拆词或只练错词。</div><div class="sentence-library">${sentenceBookRows}</div>'
new = '<div class="space"><div class="small">默认按“需重练 → 未练 → 已通过 → 忽略”排列。来源被删除或原文已修改的旧句会明确标出来。</div>${staleSentenceLinks?`<button id="cleanupStaleSentences" class="ghost">清理失效旧句 · ${staleSentenceLinks}</button>`:''}</div><div class="sentence-library">${sentenceBookRows}</div>'
assert old in s
s = s.replace(old, new, 1)
old = "  drawSentenceProblemList(); bindSentenceLibraryActions();"
new = "  drawSentenceProblemList(); bindSentenceLibraryActions();if(document.getElementById('cleanupStaleSentences'))document.getElementById('cleanupStaleSentences').onclick=()=>{if(!confirm(`清理 ${staleSentenceLinks} 条来源已删除或原文已修改的旧句记录？正式词库不会受影响。`))return;const n=removeStaleLinkedSentences(state);persist();toast(`已清理 ${n} 条旧句`);renderText();};"
assert old in s
s = s.replace(old, new, 1)

# Ask for missing Chinese meanings when sentence problem words become formal vocabulary.
old = "function importSentenceProblems(tokens,targetName,sentence){const target=String(targetName||'句子错题本').trim()||'句子错题本';registerErrorBook(target);for(const token of tokens)upsertWord({en:token.normalized||token.surface,source:target,example:token.sentence||sentence});persist();toast(`已把 ${tokens.length} 个词加入「${target}」`);}"
new = "function importSentenceProblems(tokens,targetName,sentence){const target=String(targetName||'句子错题本').trim()||'句子错题本';registerErrorBook(target);let missing=0;for(const token of tokens){const en=String(token.normalized||token.surface||'').toLowerCase();const existing=state.words.find(w=>w.en===en);let zh=existing?.zh||'';if(!zh){zh=String(window.prompt?.(`给 ${en} 补一个中文核心义（可留空，之后可在词库编辑）`,'')||'').trim();if(!zh)missing++;}upsertWord({en,zh,source:target,example:token.sentence||sentence});}persist();toast(`已把 ${tokens.length} 个词加入「${target}」${missing?` · ${missing} 个待补释义`:''}`);}"
assert old in s
s = s.replace(old, new, 1)
s = s.replace('一键加入错题本 · ${problems.length}', '加入错题本 · ${problems.length}', 1)

# Replace free listening with configurable, resumable per-book scan.
old = "function startFreeListen(book){if(!book)return toast('先在下方选择一本具体词书');const ids=state.words.filter(w=>!w.retired&&(w.sources||[]).includes(book)).map(w=>w.id);if(!ids.length)return toast('这本词书没有可自由听的词');freeListen={book,ids,index:0,revealed:false,result:null,bad:[]};renderFreeListen();speak(wordById(ids[0]).en);}"
new = "function freeProgressMap(){state.settings.freeListenProgress=state.settings.freeListenProgress&&typeof state.settings.freeListenProgress==='object'?state.settings.freeListenProgress:{};return state.settings.freeListenProgress;}\nfunction saveFreeProgress(){if(!freeListen)return;freeProgressMap()[freeListen.book]={scope:freeListen.scope,limit:freeListen.limit,index:freeListen.index,updatedAt:Date.now()};persist();}\nfunction startFreeListen(book,{scope='all',limit=0,resume=false}={}){if(!book)return toast('先选择一本具体词书');const ids=freeListenCandidates(state,book,{scope,limit});if(!ids.length)return toast(scope==='unheard'?'这本词书没有“从未正式听过”的词':'这本词书没有可自由听的词');const saved=freeProgressMap()[book];let index=resume&&saved&&saved.scope===scope&&Number(saved.limit||0)===Number(limit||0)?Math.max(0,Math.min(ids.length-1,Number(saved.index)||0)):0;freeListen={book,ids,index,scope,limit:Number(limit)||0,revealed:false,result:null,bad:[]};saveFreeProgress();renderFreeListen();speak(wordById(ids[index]).en);}"
assert old in s
s = s.replace(old, new, 1)
old = "function renderFreeListen(){const w=freeListenCurrent();if(!freeListen||!w)return finishFreeListen();root.innerHTML=`<main class=\"immersive\"><div class=\"studytop\"><button id=\"freeBack\" class=\"back\">‹</button><div class=\"studyprogress\">自由听 · ${esc(freeListen.book)} · ${freeListen.index+1}/${freeListen.ids.length}</div><div></div></div><div class=\"studybody\"><div class=\"small\">本模式不写入 FSRS、不占今日计划，只临时收集本轮不熟词。</div><button id=\"freeSpeak\" class=\"speaker\">◖))</button>${freeListen.revealed?`<div class=\"word ${freeListen.result==='good'?'good':'bad'}\">${esc(w.en)}</div><div class=\"meaning\">${esc(w.zh||'暂无中文释义')}</div><div class=\"move\"><button id=\"freeReplay\" class=\"soft\">重听</button><button id=\"freeNext\" class=\"primary\">下一词</button></div>`:`<div class=\"small\">意思能不能直接出来？</div><div class=\"judges\"><button id=\"freeGood\" class=\"goodbtn\">熟悉</button><button id=\"freeBad\" class=\"badbtn\">不熟悉</button></div>`}</div></main>`;document.getElementById('freeBack').onclick=()=>{freeListen=null;view='library';renderLibrary();};document.getElementById('freeSpeak').onclick=()=>speak(w.en);if(!freeListen.revealed){document.getElementById('freeGood').onclick=()=>{freeListen.result='good';freeListen.revealed=true;renderFreeListen();};document.getElementById('freeBad').onclick=()=>{freeListen.result='bad';freeListen.revealed=true;if(!freeListen.bad.includes(w.id))freeListen.bad.push(w.id);renderFreeListen();};}else{document.getElementById('freeReplay').onclick=()=>speak(w.en);document.getElementById('freeNext').onclick=()=>{freeListen.index++;freeListen.revealed=false;freeListen.result=null;if(freeListen.index>=freeListen.ids.length)finishFreeListen();else{renderFreeListen();speak(freeListenCurrent().en);}};}}"
new = "function renderFreeListen(){const w=freeListenCurrent();if(!freeListen||!w)return finishFreeListen();root.innerHTML=`<main class=\"immersive\"><div class=\"studytop\"><button id=\"freeBack\" class=\"back\">‹</button><div class=\"studyprogress\">自由听 · ${esc(freeListen.book)} · ${freeListen.index+1}/${freeListen.ids.length}</div><div></div></div><div class=\"studybody\"><div class=\"small\">本模式不写入 FSRS、不占今日计划；退出后可以从本书上次位置继续。</div><button id=\"freeSpeak\" class=\"speaker\">◖))</button>${freeListen.revealed?`<div class=\"word ${freeListen.result==='good'?'good':'bad'}\">${esc(w.en)}</div><div class=\"meaning\">${esc(w.zh||'暂无中文释义')}</div><div class=\"move\"><button id=\"freePrev\" class=\"soft\" ${freeListen.index===0?'disabled':''}>上一词</button><button id=\"freeReplay\" class=\"soft\">重听</button><button id=\"freeNext\" class=\"primary\">下一词</button></div>`:`<div class=\"small\">意思能不能直接出来？</div><div class=\"judges\"><button id=\"freeGood\" class=\"goodbtn\">熟悉</button><button id=\"freeBad\" class=\"badbtn\">不熟悉</button></div>`}</div></main>`;document.getElementById('freeBack').onclick=()=>{saveFreeProgress();freeListen=null;view='library';renderLibrary();};document.getElementById('freeSpeak').onclick=()=>speak(w.en);if(!freeListen.revealed){document.getElementById('freeGood').onclick=()=>{freeListen.result='good';freeListen.revealed=true;renderFreeListen();};document.getElementById('freeBad').onclick=()=>{freeListen.result='bad';freeListen.revealed=true;if(!freeListen.bad.includes(w.id))freeListen.bad.push(w.id);renderFreeListen();};}else{document.getElementById('freeReplay').onclick=()=>speak(w.en);document.getElementById('freePrev').onclick=()=>{if(freeListen.index<=0)return;freeListen.index--;freeListen.revealed=false;freeListen.result=null;saveFreeProgress();renderFreeListen();speak(freeListenCurrent().en);};document.getElementById('freeNext').onclick=()=>{freeListen.index++;freeListen.revealed=false;freeListen.result=null;if(freeListen.index>=freeListen.ids.length)finishFreeListen();else{saveFreeProgress();renderFreeListen();speak(freeListenCurrent().en);}};}}"
assert old in s
s = s.replace(old, new, 1)
old = "function finishFreeListen(){if(!freeListen)return;const run=freeListen;const bad=[...run.bad];root.innerHTML="
new = "function finishFreeListen(){if(!freeListen)return;const run=freeListen;const bad=[...run.bad];freeProgressMap()[run.book]={scope:run.scope,limit:run.limit,index:0,updatedAt:Date.now(),completedAt:Date.now()};persist();root.innerHTML="
assert old in s
s = s.replace(old, new, 1)

# Setup card for free listening.
anchor = "function renderLibrary(){"
helper = '''function freeListenSetupHtml(books){const progress=freeProgressMap();return `<section class="card"><div class="space"><div><h2 class="section-title">自由听词书</h2><div class="small">导入一整本后可以直接从头挨个听，不占今日新词/复习，也不会修改 FSRS。</div></div></div><div class="filtergrid" style="margin-top:12px"><div class="field"><label>词书</label><select id="freeListenSelect"><option value="">请选择</option>${books.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('')}</select></div><div class="field"><label>范围</label><select id="freeListenScope"><option value="all">整本</option><option value="unheard">只听从未正式听过</option></select></div><div class="field"><label>本轮数量</label><select id="freeListenLimit"><option value="50">50</option><option value="100">100</option><option value="0">全部</option></select></div><label class="small" style="align-self:end"><input id="freeListenResume" type="checkbox" checked style="width:auto"> 有记录时从上次位置继续</label></div><div id="freeListenHint" class="small" style="margin-top:9px"></div><div class="row" style="margin-top:10px"><button id="startFreeListen" class="primary">开始自由听</button></div></section>`;}\nfunction bindFreeListenSetup(){const select=document.getElementById('freeListenSelect'),hint=document.getElementById('freeListenHint');if(!select)return;const draw=()=>{const book=select.value,saved=freeProgressMap()[book];hint.textContent=saved&&Number(saved.index)>0?`上次停在第 ${Number(saved.index)+1} 个；勾选“继续”即可接着听。`:'按词库顺序播放；自由听结果只保留本轮不熟列表。';};select.onchange=draw;draw();document.getElementById('startFreeListen').onclick=()=>startFreeListen(select.value,{scope:document.getElementById('freeListenScope').value,limit:Number(document.getElementById('freeListenLimit').value)||0,resume:document.getElementById('freeListenResume').checked});}\n'''
assert anchor in s
s = s.replace(anchor, helper + anchor, 1)
s = s.replace('<button id="freeListenBook" class="soft">自由听当前词书</button>', '', 1)
old = "</details></section>${errorBookSectionHtml()}${wordEditorHtml()}${importPreviewHtml()}"
new = "</details></section>${freeListenSetupHtml(books)}${errorBookSectionHtml()}${wordEditorHtml()}${importPreviewHtml()}"
assert old in s
s = s.replace(old, new, 1)
old = "document.getElementById('speechRate').onchange=e=>{state.settings.speechRate=Math.min(1.5,Math.max(.5,Number(e.target.value)||.92));persist();};document.getElementById('freeListenBook').onclick=()=>startFreeListen(document.getElementById('wordBook').value);drawWordList();bindWordEditor();bindImportPreview();}"
new = "document.getElementById('speechRate').onchange=e=>{state.settings.speechRate=Math.min(1.5,Math.max(.5,Number(e.target.value)||.92));persist();};bindFreeListenSetup();drawWordList();bindWordEditor();bindImportPreview();}"
assert old in s
s = s.replace(old, new, 1)

p.write_text(s)
