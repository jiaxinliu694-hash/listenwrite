from pathlib import Path
import re

p = Path('src/app.js')
s = p.read_text()

s = s.replace(
"import { activeStudyDayKey, dayKey, uid, recordAttempt, editAttempt, eventsOnDay, latestEventOnDay, rebuildAllCards } from './engine.js';",
"import { activeStudyDayKey, dayKey, uid, recordAttempt, editAttempt, eventsOnDay, latestEventOnDay, rebuildAllCards, hasEventBefore } from './engine.js';"
)
s = s.replace(
"import { typePresetIds, customTypeIdsFromEvents } from './typefilters.js';",
"import { typePresetIds, customTypeIdsFromEvents } from './typefilters.js';\nimport { buildImportDraft, recordsFromDraft } from './importwords.js';\nimport { updateWordFields, deleteWordEverywhere } from './wordadmin.js';"
)
assert "buildImportDraft" in s

old = "let wholeSentenceRun = null;\nlet statRange = 30;"
new = "let wholeSentenceRun = null;\nlet wholeQueue = [];\nlet wordEditId = null;\nlet importDraft = null;\nlet freeListen = null;\nlet statRange = 30;"
assert old in s
s = s.replace(old, new, 1)

s = s.replace(
"function go(next) { speechSynthesis?.cancel(); view = next; listen = null; typeRun = null; sentenceRun = null; wholeSentenceRun = null; textReaderId = null; render(); }",
"function go(next) { speechSynthesis?.cancel(); view = next; listen = null; typeRun = null; sentenceRun = null; wholeSentenceRun = null; wholeQueue = []; freeListen = null; textReaderId = null; render(); }",
1)

# Whole-sentence queue helpers.
old = "function startWholeSentenceFromText(text,sentenceRecord,sentenceIndex){const saved=ensureLinkedSentenceEntry(text,sentenceRecord,sentenceIndex);persist();startWholeSentenceEntry(saved.book.id,saved.entry.id,{returnTextId:text.id});}\nfunction startWholeSentenceEntry(bookId,entryId,{returnTextId=null}={}){const {book,entry}=getSentenceEntry(state,bookId,entryId);if(!book||!entry)return toast('没有找到这句记录');wholeSentenceRun={bookId,entryId,returnTextId,input:'',alignment:null,revealed:false,peek:false};renderWholeSentenceRun();speak(entry.text);}"
new = "function startWholeSentenceFromText(text,sentenceRecord,sentenceIndex){const saved=ensureLinkedSentenceEntry(text,sentenceRecord,sentenceIndex);persist();startWholeSentenceEntry(saved.book.id,saved.entry.id,{returnTextId:text.id});}\nfunction startWholeSentenceEntry(bookId,entryId,{returnTextId=null,preserveQueue=false}={}){if(!preserveQueue)wholeQueue=[];const {book,entry}=getSentenceEntry(state,bookId,entryId);if(!book||!entry)return toast('没有找到这句记录');wholeSentenceRun={bookId,entryId,returnTextId,input:'',alignment:null,revealed:false,peek:false};renderWholeSentenceRun();speak(entry.text);}\nfunction startWholeSequence(items,returnTextId=null){const queue=(items||[]).filter(Boolean);if(!queue.length)return toast('没有可听写的句子');wholeQueue=queue.slice(1);const first=queue[0];startWholeSentenceEntry(first.bookId,first.entryId,{returnTextId,preserveQueue:true});}\nfunction continueWholeSequence(run){if(wholeQueue.length){const next=wholeQueue.shift();wholeSentenceRun=null;startWholeSentenceEntry(next.bookId,next.entryId,{returnTextId:run?.returnTextId||null,preserveQueue:true});return;}returnFromWholeSentenceRun(run);}"
assert old in s
s = s.replace(old, new, 1)

s = s.replace(
"function returnFromWholeSentenceRun(run){wholeSentenceRun=null;if(run?.returnTextId){textReaderId=run.returnTextId;view='text';renderTextReader();}else{view='text';renderText();}}",
"function returnFromWholeSentenceRun(run){wholeSentenceRun=null;wholeQueue=[];if(run?.returnTextId){textReaderId=run.returnTextId;view='text';renderTextReader();}else{view='text';renderText();}}",
1)

old = '<button id="wholeRetry" class="primary">再写一次整句</button><button id="wholeFinish" class="soft">返回</button>'
new = '<button id="wholeRetry" class="primary">再写一次整句</button><button id="wholeFinish" class="soft">${wholeQueue.length?`下一句 · ${wholeQueue.length}`:`返回`}</button>'
assert old in s
s = s.replace(old, new, 1)
s = s.replace("document.getElementById('wholeFinish').onclick=()=>returnFromWholeSentenceRun(run);", "document.getElementById('wholeFinish').onclick=()=>continueWholeSequence(run);", 1)

# Quick sentence/paragraph area: save, whole dictation, split dictation.
old = '<div class="row" style="margin-top:10px"><label class="small"><input id="sentenceUnique" type="checkbox" style="width:auto"> 去重后拆词</label><button id="startSentenceDictation" class="primary">保存并拆词听写</button></div>'
new = '<div class="row" style="margin-top:10px"><label class="small"><input id="sentenceUnique" type="checkbox" style="width:auto"> 去重后拆词</label><button id="startQuickWhole" class="primary">保存并整句听写</button><button id="startSentenceDictation" class="soft">保存并拆词听写</button><button id="saveQuickOnly" class="ghost">只保存</button></div>'
assert old in s
s = s.replace(old, new, 1)

anchor = "function ensureLinkedSentenceEntry(text,sentenceRecord,sentenceIndex){"
helper = """function saveQuickEntries(raw,bookName){const segments=segmentTextSentences(raw);if(!segments.length)return[];const out=[];for(const row of segments){const tokens=tokenizeEnglish(row.text,{unique:false});if(!tokens.length)continue;const saved=addSentenceEntry(state,{bookName:bookName||'句子词库',text:row.text,tokens});out.push({bookId:saved.book.id,entryId:saved.entry.id});}persist();return out;}\nfunction startQuickWhole(raw,bookName){const entries=saveQuickEntries(raw,bookName);if(!entries.length)return toast('没有识别到可听写的句子');startWholeSequence(entries,null);}\nfunction saveQuickOnly(raw,bookName){const entries=saveQuickEntries(raw,bookName);if(!entries.length)return toast('没有识别到句子');toast(`已保存 ${entries.length} 句`);renderText();}\n\n"""
assert anchor in s
s = s.replace(anchor, helper + anchor, 1)

old = "document.getElementById('startSentenceDictation').onclick=()=>startSentenceDictation(sentenceBox.value,unique.checked,document.getElementById('sentenceBookName').value);"
new = "document.getElementById('startQuickWhole').onclick=()=>startQuickWhole(sentenceBox.value,document.getElementById('sentenceBookName').value);document.getElementById('startSentenceDictation').onclick=()=>startSentenceDictation(sentenceBox.value,unique.checked,document.getElementById('sentenceBookName').value);document.getElementById('saveQuickOnly').onclick=()=>saveQuickOnly(sentenceBox.value,document.getElementById('sentenceBookName').value);"
assert old in s
s = s.replace(old, new, 1)

# Article continuous whole-sentence button and handler.
needle = '<button id="dictateWholeSentence" class="primary">整句听写</button><button id="dictateSentence" class="soft">拆词听写</button>'
replacement = '<button id="dictateWholeSentence" class="primary">整句听写</button><button id="dictateWholeSequence" class="soft">连续整句 · 最多10句</button><button id="dictateSentence" class="soft">拆词听写</button>'
assert needle in s
s = s.replace(needle, replacement, 1)

# Insert continuous handler immediately after existing whole-sentence handler.
pattern = r"(document\.getElementById\('dictateWholeSentence'\)\.onclick=\(\)=>startWholeSentenceFromText\(t,sentenceRecord,idx\);)"
m = re.search(pattern, s)
assert m, 'dictateWholeSentence handler not found'
handler = "document.getElementById('dictateWholeSequence').onclick=()=>{const entries=ss.slice(idx,idx+10).map((row,offset)=>{const saved=ensureLinkedSentenceEntry(t,row,idx+offset);return{bookId:saved.book.id,entryId:saved.entry.id};});persist();startWholeSequence(entries,t.id);};"
s = s[:m.end()] + handler + s[m.end():]

# Word editor, import preview, and free-listen helpers.
anchor = "function renderLibrary(){"
helpers = r'''function wordEditorHtml(){const w=wordById(wordEditId);if(!w)return'';return `<section class="card"><div class="space"><div><h2 class="section-title">编辑单词</h2><div class="small">英文主键保持不变；可以改释义、词性、英文定义、例句和所属词书。</div></div><button id="cancelWordEdit" class="ghost">取消</button></div><div class="grid2" style="margin-top:12px"><div class="field"><label>英文</label><input value="${esc(w.en)}" disabled></div><div class="field"><label>中文</label><input id="editWordZh" value="${esc(w.zh||'')}"></div><div class="field"><label>词性</label><input id="editWordPos" value="${esc(w.pos||'')}"></div><div class="field"><label>英文释义</label><input id="editWordDef" value="${esc(w.def||'')}"></div></div><div class="field" style="margin-top:10px"><label>所属词书（逗号分隔）</label><input id="editWordSources" value="${esc((w.sources||[]).join(', '))}"></div><div class="field" style="margin-top:10px"><label>例句（每行一条）</label><textarea id="editWordExamples" style="min-height:90px">${esc((w.examples||[]).join('\n'))}</textarea></div><div class="row" style="margin-top:10px"><button id="saveWordEdit" class="primary">保存修改</button><button id="deleteWordEdit" class="danger">彻底删除</button></div></section>`;}\nfunction bindWordEditor(){const w=wordById(wordEditId);if(!w)return;document.getElementById('cancelWordEdit').onclick=()=>{wordEditId=null;renderLibrary();};document.getElementById('saveWordEdit').onclick=()=>{updateWordFields(w,{zh:document.getElementById('editWordZh').value,pos:document.getElementById('editWordPos').value,def:document.getElementById('editWordDef').value,sources:document.getElementById('editWordSources').value.split(/[,，]/),examples:document.getElementById('editWordExamples').value.split(/\r?\n/)});persist();wordEditId=null;toast('单词已更新');renderLibrary();};document.getElementById('deleteWordEdit').onclick=()=>{if(!confirm(`彻底删除「${w.en}」？这会同时删除它的听词/手打历史和今日计划引用；句子原文不会删除。`))return;deleteWordEverywhere(state,w.id);persist();wordEditId=null;toast('已删除单词');renderLibrary();};}\nfunction importFieldSelect(field,label){if(!importDraft)return'';const options=['<option value="-1">不导入</option>'];for(let i=0;i<importDraft.width;i++){const head=importDraft.header?.[i]||`第 ${i+1} 列`;options.push(`<option value="${i}" ${Number(importDraft.map[field])===i?'selected':''}>${esc(head)}</option>`);}return `<label class="small">${label}<select data-import-field="${field}">${options.join('')}</select></label>`;}\nfunction importPreviewHtml(){if(!importDraft)return'';const rows=recordsFromDraft(importDraft,importDraft.map);const valid=rows.filter(r=>r.valid);return `<section class="card"><div class="space"><div><h2 class="section-title">确认导入 · ${esc(importDraft.fileName)}</h2><div class="small">${importDraft.delimiter==='\t'?'TSV':'CSV'} · ${valid.length} 行可导入。先确认列映射，再写入词库。</div></div><button id="cancelImportDraft" class="ghost">取消</button></div><div class="filtergrid" style="margin-top:12px">${importFieldSelect('en','英文')}${importFieldSelect('zh','中文')}${importFieldSelect('pos','词性')}${importFieldSelect('def','英文释义')}${importFieldSelect('source','词书/来源')}${importFieldSelect('example','例句')}</div><label class="small" style="display:block;margin-top:10px"><input id="importOverwrite" type="checkbox" style="width:auto"> 已存在单词：用本次非空字段覆盖旧释义/词性/定义</label><div class="error-compact" style="margin-top:10px">${valid.slice(0,10).map(r=>`<div class="error-row"><span class="en">${esc(r.en)}</span><span class="zh">${esc(r.zh||'—')}</span><span class="small">${esc(r.source||'')}</span></div>`).join('')||'<div class="empty">没有可导入行</div>'}</div><div class="row" style="margin-top:12px"><button id="confirmImportDraft" class="primary" ${valid.length?'':'disabled'}>确认导入 · ${valid.length}</button></div></section>`;}\nfunction bindImportPreview(){if(!importDraft)return;document.getElementById('cancelImportDraft').onclick=()=>{importDraft=null;renderLibrary();};document.querySelectorAll('[data-import-field]').forEach(el=>el.onchange=()=>{importDraft.map[el.dataset.importField]=Number(el.value);renderLibrary();});document.getElementById('confirmImportDraft').onclick=()=>{const overwrite=document.getElementById('importOverwrite').checked;const rows=recordsFromDraft(importDraft,importDraft.map).filter(r=>r.valid);let added=0,updated=0;for(const row of rows){const existed=state.words.some(w=>w.en===String(row.en).trim().toLowerCase());if(/错题|错词|error/i.test(row.source))registerErrorBook(row.source);upsertWord({...row,overwrite});existed?updated++:added++;}persist();importDraft=null;toast(`导入完成：新增 ${added} · 已存在 ${updated}`);renderLibrary();};}\nfunction startFreeListen(book){if(!book)return toast('先在下方选择一本具体词书');const ids=state.words.filter(w=>!w.retired&&(w.sources||[]).includes(book)).map(w=>w.id);if(!ids.length)return toast('这本词书没有可自由听的词');freeListen={book,ids,index:0,revealed:false,result:null,bad:[]};renderFreeListen();speak(wordById(ids[0]).en);}\nfunction freeListenCurrent(){return wordById(freeListen?.ids?.[freeListen.index]);}\nfunction renderFreeListen(){const w=freeListenCurrent();if(!freeListen||!w)return finishFreeListen();root.innerHTML=`<main class="immersive"><div class="studytop"><button id="freeBack" class="back">‹</button><div class="studyprogress">自由听 · ${esc(freeListen.book)} · ${freeListen.index+1}/${freeListen.ids.length}</div><div></div></div><div class="studybody"><div class="small">本模式不写入 FSRS、不占今日计划，只临时收集本轮不熟词。</div><button id="freeSpeak" class="speaker">◖))</button>${freeListen.revealed?`<div class="word ${freeListen.result==='good'?'good':'bad'}">${esc(w.en)}</div><div class="meaning">${esc(w.zh||'暂无中文释义')}</div><div class="move"><button id="freeReplay" class="soft">重听</button><button id="freeNext" class="primary">下一词</button></div>`:`<div class="small">意思能不能直接出来？</div><div class="judges"><button id="freeGood" class="goodbtn">熟悉</button><button id="freeBad" class="badbtn">不熟悉</button></div>`}</div></main>`;document.getElementById('freeBack').onclick=()=>{freeListen=null;view='library';renderLibrary();};document.getElementById('freeSpeak').onclick=()=>speak(w.en);if(!freeListen.revealed){document.getElementById('freeGood').onclick=()=>{freeListen.result='good';freeListen.revealed=true;renderFreeListen();};document.getElementById('freeBad').onclick=()=>{freeListen.result='bad';freeListen.revealed=true;if(!freeListen.bad.includes(w.id))freeListen.bad.push(w.id);renderFreeListen();};}else{document.getElementById('freeReplay').onclick=()=>speak(w.en);document.getElementById('freeNext').onclick=()=>{freeListen.index++;freeListen.revealed=false;freeListen.result=null;if(freeListen.index>=freeListen.ids.length)finishFreeListen();else{renderFreeListen();speak(freeListenCurrent().en);}};}}\nfunction addFreeBadToToday(ids){const date=currentDayKey();const books=state.settings.todayBooks||[];const plan=ensureDailyPlan(state,planForTodayOptions(date,books));if(plan.mode==='sequential')return toast('当前是分本依次计划，请在今日页调整后再加入');let added=0;for(const id of ids){if(plan.newIds.includes(id)||plan.reviewIds.includes(id))continue;(hasEventBefore(state,id,date)?plan.reviewIds:plan.newIds).push(id);added++;}plan.newTarget=Math.max(plan.newTarget,plan.newIds.length);plan.reviewTarget=Math.max(plan.reviewTarget,plan.reviewIds.length);plan.updatedAt=Date.now();persist();toast(`已加入今日计划 ${added} 个`);}\nfunction finishFreeListen(){if(!freeListen)return;const run=freeListen;const bad=[...run.bad];root.innerHTML=`<main class="immersive"><div class="studybody"><div class="finish"><div class="small">自由听完成 · 不影响 FSRS</div><h2>${esc(run.book)}</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${run.ids.length}</b><span>本轮词数</span></div><div class="statbox"><b class="bad">${bad.length}</b><span>本轮不熟</span></div><div class="statbox"><b>${run.ids.length-bad.length}</b><span>其余熟悉</span></div></div><div class="row" style="justify-content:center">${bad.length?`<button id="freeToType" class="primary">手打这批 · ${bad.length}</button><button id="freeToToday" class="soft">加入今日计划</button>`:''}<button id="freeFinish" class="ghost">返回词库</button></div></div></div></main>`;if(document.getElementById('freeToType'))document.getElementById('freeToType').onclick=()=>{freeListen=null;view='type';startType(bad,`${run.book} · 自由听不熟`);};if(document.getElementById('freeToToday'))document.getElementById('freeToToday').onclick=()=>addFreeBadToToday(bad);document.getElementById('freeFinish').onclick=()=>{freeListen=null;view='library';renderLibrary();};}\n\n'''
assert anchor in s
s = s.replace(anchor, helpers + anchor, 1)

# Add editor/import preview to library and free-listen button.
needle = "${errorBookSectionHtml()}<section class=\"card\"><div class=\"space\"><div><h2 class=\"section-title\">全部词库</h2>"
replacement = "${errorBookSectionHtml()}${wordEditorHtml()}${importPreviewHtml()}<section class=\"card\"><div class=\"space\"><div><h2 class=\"section-title\">全部词库</h2>"
assert needle in s
s = s.replace(needle, replacement, 1)
needle = '<button id="importWords" class="primary">导入 CSV / TXT</button><button id="backupWords" class="soft">完整备份</button>'
replacement = '<button id="importWords" class="primary">导入 CSV / TXT</button><button id="freeListenBook" class="soft">自由听当前词书</button><button id="backupWords" class="soft">完整备份</button>'
assert needle in s
s = s.replace(needle, replacement, 1)

# Bind extra library actions at function tail.
old = "document.getElementById('speechRate').onchange=e=>{state.settings.speechRate=Math.min(1.5,Math.max(.5,Number(e.target.value)||.92));persist();};drawWordList();}"
new = "document.getElementById('speechRate').onchange=e=>{state.settings.speechRate=Math.min(1.5,Math.max(.5,Number(e.target.value)||.92));persist();};document.getElementById('freeListenBook').onclick=()=>startFreeListen(document.getElementById('wordBook').value);drawWordList();bindWordEditor();bindImportPreview();}"
assert old in s
s = s.replace(old, new, 1)

# Word list edit/delete buttons and handlers.
old = '<button class="soft" data-retire="${w.id}">${w.retired?\'恢复\':\'简单\'}</button>'
new = '<div class="row"><button class="ghost" data-edit-word="${w.id}">编辑</button><button class="soft" data-retire="${w.id}">${w.retired?\'恢复\':\'简单\'}</button><button class="danger" data-delete-word="${w.id}">删除</button></div>'
assert old in s
s = s.replace(old, new, 1)
old = "document.querySelectorAll('[data-retire]').forEach(b=>b.onclick=()=>{const w=wordById(b.dataset.retire);markSimpleLexeme(state,w.en,!w.retired);persist();drawWordList();});}"
new = "document.querySelectorAll('[data-retire]').forEach(b=>b.onclick=()=>{const w=wordById(b.dataset.retire);markSimpleLexeme(state,w.en,!w.retired);persist();drawWordList();});document.querySelectorAll('[data-edit-word]').forEach(b=>b.onclick=()=>{wordEditId=b.dataset.editWord;renderLibrary();});document.querySelectorAll('[data-delete-word]').forEach(b=>b.onclick=()=>{const w=wordById(b.dataset.deleteWord);if(!w||!confirm(`彻底删除「${w.en}」？学习历史和今日计划引用也会删除。`))return;deleteWordEverywhere(state,w.id);persist();toast('已删除单词');renderLibrary();});}"
assert old in s
s = s.replace(old, new, 1)

# Allow overwrite during imports.
old = "function upsertWord({en,zh='',pos='',def='',source='',example=''}){en=String(en||'').trim().toLowerCase();if(!en)return null;let w=state.words.find(x=>x.en===en);if(!w){w={id:uid('w'),en,zh,pos,def,sources:[],examples:[],retired:isSimpleLexeme(state,en),card:null};state.words.push(w);}if(isSimpleLexeme(state,en))w.retired=true;if(zh&&!w.zh)w.zh=zh;if(pos&&!w.pos)w.pos=pos;if(def&&!w.def)w.def=def;if(source&&!w.sources.includes(source))w.sources.push(source);if(example&&!w.examples.includes(example))w.examples.push(example);return w;}"
new = "function upsertWord({en,zh='',pos='',def='',source='',example='',overwrite=false}){en=String(en||'').trim().toLowerCase();if(!en)return null;let w=state.words.find(x=>x.en===en);if(!w){w={id:uid('w'),en,zh,pos,def,sources:[],examples:[],retired:isSimpleLexeme(state,en),card:null};state.words.push(w);}if(isSimpleLexeme(state,en))w.retired=true;if(zh&&(overwrite||!w.zh))w.zh=zh;if(pos&&(overwrite||!w.pos))w.pos=pos;if(def&&(overwrite||!w.def))w.def=def;if(source&&!w.sources.includes(source))w.sources.push(source);if(example&&!w.examples.includes(example))w.examples.push(example);return w;}"
assert old in s
s = s.replace(old, new, 1)

# File import now opens preview rather than mutating immediately.
old = "importInput.onchange=async()=>{const f=importInput.files?.[0];if(!f)return;parseWordFile(await f.text(),f.name);importInput.value='';};"
new = "importInput.onchange=async()=>{const f=importInput.files?.[0];if(!f)return;importDraft=buildImportDraft(await f.text(),f.name);wordEditId=null;view='library';renderLibrary();importInput.value='';};"
assert old in s
s = s.replace(old, new, 1)

# Main renderer knows about free-listen immersive mode.
old = "function render(){try{if(listen)return renderListen();if(typeRun)return renderTypeRun();if(sentenceRun)return renderSentenceRun();"
new = "function render(){try{if(freeListen)return renderFreeListen();if(listen)return renderListen();if(typeRun)return renderTypeRun();if(sentenceRun)return renderSentenceRun();"
assert old in s
s = s.replace(old, new, 1)

p.write_text(s)
