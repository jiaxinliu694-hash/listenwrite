from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label):
    out, n = re.subn(pattern, lambda m: repl, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'{label}: matched {n}')
    return out

# ---------- sentencebooks ----------
p = Path('src/sentencebooks.js')
s = p.read_text()
if "VALID_PRACTICE_STATUS" not in s:
    s = replace_once(s,
        "const VALID_STATUS = new Set(['familiar', 'unfamiliar', 'unknown']);",
        "const VALID_STATUS = new Set(['familiar', 'unfamiliar', 'unknown']);\nconst VALID_PRACTICE_STATUS = new Set(['unseen', 'repeat', 'done', 'ignored']);",
        'sentence practice status const')
    s = replace_once(s,
        "function sameSource(entry, sourceTextId, sentenceIndex) {\n  return String(entry.sourceTextId || '') === String(sourceTextId || '')\n    && Number(entry.sentenceIndex ?? -1) === Number(sentenceIndex ?? -1);\n}",
        "function sameSource(entry, sourceTextId, sentenceIndex, sourceSentenceId = null) {\n  if (sourceSentenceId && entry.sourceSentenceId) return String(entry.sourceSentenceId) === String(sourceSentenceId);\n  return String(entry.sourceTextId || '') === String(sourceTextId || '')\n    && Number(entry.sentenceIndex ?? -1) === Number(sentenceIndex ?? -1);\n}",
        'same source stable id')
    s = replace_once(s,
        "  sourceTextId = null,\n  sourceTitle = '',",
        "  sourceTextId = null,\n  sourceSentenceId = null,\n  sourceTitle = '',",
        'add sourceSentenceId arg')
    s = replace_once(s,
        "let entry = book.entries.find((candidate) => candidate.text === cleanText && sameSource(candidate, sourceTextId, sentenceIndex));",
        "let entry = book.entries.find((candidate) => candidate.text === cleanText && sameSource(candidate, sourceTextId, sentenceIndex, sourceSentenceId));",
        'find by stable sentence')
    s = replace_once(s,
        "    if (sourceTextId) entry.sourceTextId = sourceTextId;\n    if (sentenceIndex != null) entry.sentenceIndex = Number(sentenceIndex);",
        "    if (sourceTextId) entry.sourceTextId = sourceTextId;\n    if (sourceSentenceId) entry.sourceSentenceId = sourceSentenceId;\n    if (sentenceIndex != null) entry.sentenceIndex = Number(sentenceIndex);",
        'reuse stable sentence id')
    s = replace_once(s,
        "    sourceTextId: sourceTextId || null,\n    sourceTitle: String(sourceTitle || ''),",
        "    sourceTextId: sourceTextId || null,\n    sourceSentenceId: sourceSentenceId || null,\n    sourceTitle: String(sourceTitle || ''),",
        'new stable sentence id')
    s = replace_once(s,
        "    updatedAt: Date.now(),\n    tokens: tokens.map((surface, index) => ({",
        "    updatedAt: Date.now(),\n    lastPracticedAt: 0,\n    practiceStatus: 'unseen',\n    wholeAttempts: [],\n    tokens: tokens.map((surface, index) => ({",
        'new sentence practice fields')
    anchor = "export function sentencePracticeIndexes(state, entry, {"
    helpers = """export function deriveSentencePracticeStatus(entry) {
  if (!entry) return 'unseen';
  if (entry.practiceStatus === 'ignored') return 'ignored';
  if (entry.practiceStatus === 'done' || entry.practiceStatus === 'repeat') return entry.practiceStatus;
  const tokens = Array.isArray(entry.tokens) ? entry.tokens : [];
  if (tokens.some((token) => token.status === 'unfamiliar' || token.status === 'unknown')) return 'repeat';
  if ((Array.isArray(entry.wholeAttempts) && entry.wholeAttempts.length) || tokens.some((token) => Array.isArray(token.attempts) && token.attempts.length)) return 'done';
  return 'unseen';
}

export function setSentencePracticeStatus(entry, status) {
  if (!entry || !VALID_PRACTICE_STATUS.has(status)) return null;
  entry.practiceStatus = status;
  entry.lastPracticedAt = Date.now();
  entry.updatedAt = Date.now();
  return entry.practiceStatus;
}

export function recordWholeSentenceAttempt(entry, { input = '', alignment = null, revealed = false } = {}) {
  if (!entry) return null;
  entry.wholeAttempts = Array.isArray(entry.wholeAttempts) ? entry.wholeAttempts : [];
  const attempt = {
    ts: Date.now(),
    input: String(input || ''),
    revealed: Boolean(revealed),
    correct: Boolean(!revealed && alignment?.correct),
    distance: Number(alignment?.distance) || 0,
    operations: Array.isArray(alignment?.operations) ? alignment.operations.map((op) => ({
      type: op.type,
      expected: op.expected || '',
      actual: op.actual || '',
      expectedIndex: Number.isInteger(op.expectedIndex) ? op.expectedIndex : null,
      actualIndex: Number.isInteger(op.actualIndex) ? op.actualIndex : null,
    })) : [],
  };
  entry.wholeAttempts.push(attempt);
  entry.practiceStatus = attempt.correct ? 'done' : 'repeat';
  entry.lastPracticedAt = attempt.ts;
  entry.updatedAt = attempt.ts;
  return attempt;
}

"""
    s = replace_once(s, anchor, helpers + anchor, 'sentence practice helpers')
    s = replace_once(s,
        "    for (const entry of book.entries || []) {\n      const problems = sentenceProblemOccurrences(entry);",
        "    for (const entry of book.entries || []) {\n      if (deriveSentencePracticeStatus(entry) === 'ignored') continue;\n      const problems = sentenceProblemOccurrences(entry);",
        'ignore sentence problems')
    s = replace_once(s,
        "      sourceTextId: entry.sourceTextId || null,\n      sourceTitle: String(entry.sourceTitle || ''),",
        "      sourceTextId: entry.sourceTextId || null,\n      sourceSentenceId: entry.sourceSentenceId || null,\n      sourceTitle: String(entry.sourceTitle || ''),",
        'normalize stable sentence id')
    s = replace_once(s,
        "      updatedAt: Number(entry.updatedAt) || Date.now(),\n      tokens: (Array.isArray(entry.tokens) ? entry.tokens : []).map((token, ti) => ({",
        "      updatedAt: Number(entry.updatedAt) || Date.now(),\n      lastPracticedAt: Number(entry.lastPracticedAt) || 0,\n      practiceStatus: VALID_PRACTICE_STATUS.has(entry.practiceStatus) ? entry.practiceStatus : 'unseen',\n      wholeAttempts: Array.isArray(entry.wholeAttempts) ? entry.wholeAttempts : [],\n      tokens: (Array.isArray(entry.tokens) ? entry.tokens : []).map((token, ti) => ({",
        'normalize sentence practice fields')
p.write_text(s)

# ---------- storage ----------
p = Path('src/storage.js')
s = p.read_text()
if "normalizeTexts" not in s:
    s = replace_once(s,
        "import { normalizeSentenceBooks, ensureSimpleWords, normalizeLexeme } from './sentencebooks.js';",
        "import { normalizeSentenceBooks, ensureSimpleWords, normalizeLexeme } from './sentencebooks.js';\nimport { normalizeTexts } from './textsentences.js';",
        'storage text import')
s = s.replace('version: 8,', 'version: 9,', 1)
s = replace_once(s, "state.texts = Array.isArray(input?.texts) ? input.texts : [];", "state.texts = normalizeTexts(input?.texts);", 'normalize texts')
s = s.replace('state.version = 8;', 'state.version = 9;')
p.write_text(s)

# ---------- styles ----------
p = Path('styles.css')
s = p.read_text()
if '.sentence-library{' not in s:
    s += '''\n.sentence-library{display:grid;gap:9px;margin-top:12px}.sentence-book{border:1px solid rgba(90,80,65,.1);border-radius:15px;background:#fffdfa;padding:0 12px}.sentence-book>summary{padding:11px 0;cursor:pointer;display:flex;justify-content:space-between;gap:10px}.sentence-entry{padding:10px 0;border-top:1px solid rgba(90,80,65,.07)}.sentence-entry:first-of-type{border-top:0}.sentence-entry-text{font-size:13px;line-height:1.55;margin:3px 0 7px}.sentence-entry-meta{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.sentence-state{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:3px 7px;background:#fff}.sentence-state.repeat{color:var(--red)}.sentence-state.done{color:var(--green)}.sentence-state.ignored{color:var(--muted)}.sentence-diff{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:720px;margin:17px auto;font-size:16px;line-height:1.8}.sentence-diff span{padding:2px 5px;border-radius:6px}.sentence-diff .equal{color:var(--green);background:rgba(76,110,84,.08)}.sentence-diff .replace,.sentence-diff .missing{color:var(--red);background:rgba(157,78,63,.09)}.sentence-diff .extra{color:#8a6a2f;background:rgba(150,120,50,.1)}.whole-answer{width:100%;max-width:720px;min-height:105px;font-size:18px;line-height:1.6;margin-top:18px}.sentence-mode-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.sentence-mode-row button{font-size:12px;padding:7px 9px}\n'''
p.write_text(s)

# ---------- app ----------
p = Path('src/app.js')
s = p.read_text()
if "alignSentenceInput" not in s:
    s = replace_once(s,
        "import { tokenizeEnglish, spellingMatches } from './tokenizer.js';",
        "import { tokenizeEnglish, spellingMatches } from './tokenizer.js';\nimport { segmentTextSentences, reconcileTextSentences, alignSentenceInput } from './textsentences.js';",
        'app text sentence import')
    s = replace_once(s,
        "import { ensureSentenceBooks, ensureSimpleWords, isSimpleLexeme, markSimpleLexeme, addSentenceEntry, getSentenceEntry, recordSentenceToken, setSentenceTokenStatus, sentencePracticeIndexes, sentenceProblemTokens, allSentenceProblemTokens, findSentenceProblemEntries, sentenceSourceLabel, problemTokensToTSV } from './sentencebooks.js';",
        "import { ensureSentenceBooks, ensureSimpleWords, isSimpleLexeme, markSimpleLexeme, addSentenceEntry, getSentenceEntry, recordSentenceToken, setSentenceTokenStatus, sentencePracticeIndexes, sentenceProblemTokens, allSentenceProblemTokens, findSentenceProblemEntries, sentenceSourceLabel, problemTokensToTSV, deriveSentencePracticeStatus, setSentencePracticeStatus, recordWholeSentenceAttempt } from './sentencebooks.js';",
        'app sentence practice import')
    s = replace_once(s, "let sentenceRun = null;", "let sentenceRun = null;\nlet wholeSentenceRun = null;", 'whole run state')
    s = replace_once(s,
        "function go(next) { speechSynthesis?.cancel(); view = next; listen = null; typeRun = null; sentenceRun = null; textReaderId = null; render(); }",
        "function go(next) { speechSynthesis?.cancel(); view = next; listen = null; typeRun = null; sentenceRun = null; wholeSentenceRun = null; textReaderId = null; render(); }",
        'clear whole run')

s = sub_once(s,
    r"function splitSentences\(body\)\{.*?\}\nfunction renderText\(\)\{",
    """function splitSentences(body){return segmentTextSentences(body).map(row=>row.text);}
function sentenceStateInfo(entry){const status=deriveSentencePracticeStatus(entry);return {status,label:status==='repeat'?'需重练':status==='done'?'已通过':status==='ignored'?'忽略':'未练'};}
function sentenceLibraryBookHtml(book){
  const rank={repeat:0,unseen:1,done:2,ignored:3};
  const entries=[...(book.entries||[])].sort((a,b)=>(rank[sentenceStateInfo(a).status]-rank[sentenceStateInfo(b).status])||(Number(b.lastPracticedAt||b.updatedAt||0)-Number(a.lastPracticedAt||a.updatedAt||0)));
  const repeat=entries.filter(e=>sentenceStateInfo(e).status==='repeat').length;
  return `<details class=\"sentence-book\"><summary><b>${esc(book.name)}</b><span class=\"small\">${entries.length} 句${repeat?` · ${repeat} 句需重练`:''}</span></summary><div>${entries.map(entry=>{const st=sentenceStateInfo(entry);const problems=sentenceProblemTokens(entry).filter(token=>!isSimpleLexeme(state,token.normalized||token.surface));return`<div class=\"sentence-entry\"><div class=\"sentence-entry-meta\"><span class=\"sentence-state ${st.status}\">${st.label}</span><span class=\"small\">${esc(sentenceSourceLabel(entry))}${problems.length?` · 错词 ${problems.length}`:''}</span></div><div class=\"sentence-entry-text\">${esc(entry.text)}</div><div class=\"sentence-mode-row\"><button class=\"soft\" data-whole-entry=\"${book.id}|${entry.id}\">整句听写</button><button class=\"soft\" data-split-entry=\"${book.id}|${entry.id}\">拆词听写</button>${problems.length?`<button class=\"soft\" data-problem-entry=\"${book.id}|${entry.id}\">只练错词</button>`:''}<button class=\"ghost\" data-ignore-entry=\"${book.id}|${entry.id}\">${st.status==='ignored'?'恢复':'忽略'}</button></div></div>`;}).join('')||'<div class=\"empty\">还没有句子。</div>'}</div></details>`;
}
function bindSentenceLibraryActions(){
  document.querySelectorAll('[data-whole-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.wholeEntry.split('|');startWholeSentenceEntry(bookId,entryId);});
  document.querySelectorAll('[data-split-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.splitEntry.split('|');startSavedEntryDictation(bookId,entryId,{onlyProblems:false,unique:false});});
  document.querySelectorAll('[data-problem-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.problemEntry.split('|');startSavedEntryDictation(bookId,entryId,{onlyProblems:true,unique:true});});
  document.querySelectorAll('[data-ignore-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.ignoreEntry.split('|');const {entry}=getSentenceEntry(state,bookId,entryId);if(!entry)return;setSentencePracticeStatus(entry,deriveSentencePracticeStatus(entry)==='ignored'?'unseen':'ignored');persist();renderText();});
}
function renderText(){""",
    'replace sentence splitter and helpers')

# Replace renderText so sentence library is a real browser, while retaining text creation/search.
start = s.index('function renderText(){')
end = s.index('\nfunction activeProblemRows()', start)
new_render_text = r'''function renderText(){
  if(textReaderId)return renderTextReader();
  ensureSentenceBooks(state); ensureSimpleWords(state);
  const cols=[...new Set(state.texts.map(t=>t.collection||'未分类'))].sort();
  const editing=textEditId?state.texts.find(t=>t.id===textEditId):null;
  const sentenceBookNames=state.sentenceBooks.map(b=>b.name);
  const sentenceBookRows=state.sentenceBooks.map(sentenceLibraryBookHtml).join('');
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>文本与句子</h2><p>文章 → 稳定句子 → 整句听写 / 拆词听写 / 错词重听。句子本身不进入 FSRS；导入普通词书的错词才进入正式复习。</p></div><button id="newText" class="primary">${textFormOpen||editing?'收起':'新建文本'}</button></div></section><section class="card"><h2 class="section-title">快速保存一句并拆词</h2><div class="small">适合临时句子。默认保留重复词位置；标记简单的词自动跳过。</div><div class="field" style="margin-top:10px"><label>保存到句子库</label><input id="sentenceBookName" list="sentenceBookNames" value="${esc(sentenceBookNames[0]||'句子词库')}" placeholder="例如：剑18句子"><datalist id="sentenceBookNames">${sentenceBookNames.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div><textarea id="sentenceDictationText" style="min-height:105px;margin-top:10px" placeholder="The farmers are working in rural areas."></textarea><div class="row" style="margin-top:10px"><label class="small"><input id="sentenceUnique" type="checkbox" style="width:auto"> 去重后拆词</label><button id="startSentenceDictation" class="primary">保存并拆词听写</button></div><div id="sentencePreview" class="source-tags" style="justify-content:flex-start;margin-top:10px"></div></section><section class="card"><h2 class="section-title">句子错词定位与重听</h2><div class="small">可以搜文章标题、句子原文或单词；从文章产生的句子使用稳定句子 ID 关联，不再只靠“第几句”。</div><div class="filtergrid" style="margin-top:12px"><div class="field"><label>句子库</label><select id="sentenceProblemBook"><option value="">全部句子库</option>${state.sentenceBooks.map(book=>`<option value="${book.id}">${esc(book.name)}</option>`).join('')}</select></div><div class="field"><label>检索</label><input id="sentenceProblemSearch" placeholder="文章标题 / 句子 / 错词"></div></div><label class="small" style="display:block;margin-top:10px"><input id="sentenceProblemUnique" type="checkbox" checked style="width:auto"> 错词重听时去重</label><div id="sentenceProblemList" style="margin-top:12px"></div></section>${state.sentenceBooks.length?`<section class="card"><h2 class="section-title">我的句子库</h2><div class="small">默认按“需重练 → 未练 → 已通过 → 忽略”排列。每一句都能重新做整句、拆词或只练错词。</div><div class="sentence-library">${sentenceBookRows}</div></section>`:''}${textFormOpen||editing?`<section class="card"><h2 class="section-title">${editing?'编辑文本':'新建文本'}</h2><div class="grid2" style="margin-top:12px"><div class="field"><label>标题</label><input id="textTitle" value="${esc(editing?.title||'')}" placeholder="Test 3 Part 4"></div><div class="field"><label>所属文本库</label><input id="textCollection" value="${esc(editing?.collection||'')}" placeholder="剑18"></div></div><textarea id="textBody" style="margin-top:10px" placeholder="粘贴 transcript / 文章正文…">${esc(editing?.body||'')}</textarea><div class="row" style="margin-top:10px"><button id="saveText" class="primary">保存</button><button id="importTextFile" class="soft">导入 TXT</button></div></section>`:''}<section class="card"><div class="space"><div><h2 class="section-title">我的文本</h2><div class="small">打开文章后，每一句都有“整句听写 / 拆词听写 / 本句错词”。</div></div></div><div class="grid2" style="margin-top:12px"><input id="textSearch" placeholder="搜索文本"><select id="textFilter"><option value="">全部文本库</option>${cols.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div><div id="textList" class="list" style="margin-top:12px"></div></section></div>`);
  document.getElementById('newText').onclick=()=>{textFormOpen=!textFormOpen;if(!textFormOpen)textEditId=null;renderText();};
  if(textFormOpen||editing){document.getElementById('saveText').onclick=saveTextItem;document.getElementById('importTextFile').onclick=()=>textInput.click();}
  const sentenceBox=document.getElementById('sentenceDictationText'),unique=document.getElementById('sentenceUnique'),preview=document.getElementById('sentencePreview');
  const drawSentencePreview=()=>{const tokens=tokenizeEnglish(sentenceBox.value,{unique:unique.checked});preview.innerHTML=tokens.slice(0,30).map(x=>`<span class="tag">${esc(x)}${isSimpleLexeme(state,x)?' · 简单':''}</span>`).join('')+(tokens.length>30?`<span class="tag">… 共 ${tokens.length} 个</span>`:'');};
  sentenceBox.oninput=drawSentencePreview; unique.onchange=drawSentencePreview;
  document.getElementById('startSentenceDictation').onclick=()=>startSentenceDictation(sentenceBox.value,unique.checked,document.getElementById('sentenceBookName').value);
  document.getElementById('sentenceProblemBook').onchange=drawSentenceProblemList;
  document.getElementById('sentenceProblemSearch').oninput=drawSentenceProblemList;
  document.getElementById('sentenceProblemUnique').onchange=drawSentenceProblemList;
  drawSentenceProblemList(); bindSentenceLibraryActions();
  document.getElementById('textSearch').oninput=drawTextList;document.getElementById('textFilter').onchange=drawTextList;drawTextList();
}'''
s = s[:start] + new_render_text + s[end:]

# Problem list: correct old fake 'whole sentence' label and add true whole sentence action.
start = s.index('function drawSentenceProblemList(){')
end = s.index('\n\nfunction startSentenceDictation', start)
new_problem = r'''function drawSentenceProblemList(){
  const box=document.getElementById('sentenceProblemList');if(!box)return;
  const rows=activeProblemRows();const uniqueWords=new Set(rows.flatMap(row=>row.problems.map(token=>token.normalized||String(token.surface).toLowerCase())));const unique=document.getElementById('sentenceProblemUnique')?.checked!==false;
  box.innerHTML=`<div class="space"><div><b>${rows.length} 句 · ${uniqueWords.size} 个错词</b><div class="small">点某一句精准重练，也可以把当前检索结果一起重听。</div></div><button id="retryFilteredProblems" class="primary" ${rows.length?'':'disabled'}>重听当前筛选错词</button></div><div style="margin-top:10px">${rows.map(row=>`<article class="textitem"><div class="space"><div><h3>${esc(sentenceSourceLabel(row.entry))}</h3><div class="small">${esc(row.book.name)} · ${problemSummary(row.problems)}</div></div></div><p class="snippet">${esc(row.entry.text)}</p><div class="toolbar"><button class="primary" data-whole-problem-entry="${row.book.id}|${row.entry.id}">整句听写</button><button class="soft" data-retry-entry="${row.book.id}|${row.entry.id}">只重听这句错词</button><button class="soft" data-retry-entry-all="${row.book.id}|${row.entry.id}">重做本句拆词</button></div></article>`).join('')}</div>`;
  document.getElementById('retryFilteredProblems').onclick=()=>startSentenceProblemRows(rows,unique,'筛选出来的句子错词');
  document.querySelectorAll('[data-whole-problem-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.wholeProblemEntry.split('|');startWholeSentenceEntry(bookId,entryId);});
  document.querySelectorAll('[data-retry-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.retryEntry.split('|');startSavedEntryDictation(bookId,entryId,{onlyProblems:true,unique});});
  document.querySelectorAll('[data-retry-entry-all]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.retryEntryAll.split('|');startSavedEntryDictation(bookId,entryId,{onlyProblems:false,unique:false});});
}'''
s = s[:start] + new_problem + s[end:]

# Add true whole-sentence dictation engine immediately before split dictation.
insert_at = s.index('function startSentenceDictation')
whole_engine = r'''function ensureLinkedSentenceEntry(text,sentenceRecord,sentenceIndex){
  const allTokens=tokenizeEnglish(sentenceRecord.text,{unique:false});
  return addSentenceEntry(state,{bookName:`${text.collection||'文本'} · 句子`,text:sentenceRecord.text,tokens:allTokens,sourceTextId:text.id,sourceSentenceId:sentenceRecord.id,sourceTitle:text.title,sourceCollection:text.collection||'未分类',sentenceIndex});
}
function startWholeSentenceFromText(text,sentenceRecord,sentenceIndex){const saved=ensureLinkedSentenceEntry(text,sentenceRecord,sentenceIndex);persist();startWholeSentenceEntry(saved.book.id,saved.entry.id,{returnTextId:text.id});}
function startWholeSentenceEntry(bookId,entryId,{returnTextId=null}={}){const {book,entry}=getSentenceEntry(state,bookId,entryId);if(!book||!entry)return toast('没有找到这句记录');wholeSentenceRun={bookId,entryId,returnTextId,input:'',alignment:null,revealed:false,peek:false};renderWholeSentenceRun();speak(entry.text);}
function wholeSentenceCurrent(){if(!wholeSentenceRun)return{};return getSentenceEntry(state,wholeSentenceRun.bookId,wholeSentenceRun.entryId);}
function applyWholeAlignment(entry,alignment){const wrong=new Set(alignment.wrongExpectedIndexes||[]);for(let i=0;i<(entry.tokens||[]).length;i++){const token=entry.tokens[i];if(isSimpleLexeme(state,token.normalized||token.surface)){setSentenceTokenStatus(entry,i,'familiar');continue;}setSentenceTokenStatus(entry,i,wrong.has(i)?'unfamiliar':'familiar');}}
function wholeDiffHtml(alignment){if(!alignment)return'';return `<div class="sentence-diff">${alignment.operations.map(op=>op.type==='equal'?`<span class="equal">${esc(op.expected)}</span>`:op.type==='replace'?`<span class="replace">${esc(op.expected)} → ${esc(op.actual)}</span>`:op.type==='missing'?`<span class="missing">${esc(op.expected)}（漏）</span>`:`<span class="extra">+ ${esc(op.actual)}</span>`).join('')}</div>`;}
function returnFromWholeSentenceRun(run){wholeSentenceRun=null;if(run?.returnTextId){textReaderId=run.returnTextId;view='text';renderTextReader();}else{view='text';renderText();}}
function renderWholeSentenceRun(){
  const run=wholeSentenceRun;const {book,entry}=wholeSentenceCurrent();if(!run||!book||!entry){wholeSentenceRun=null;view='text';return renderText();}
  const st=sentenceStateInfo(entry);const problems=sentenceProblemTokens(entry).filter(token=>!isSimpleLexeme(state,token.normalized||token.surface));
  root.innerHTML=`<main class="immersive"><div class="studytop"><button id="wholeBack" class="back">‹</button><div class="studyprogress">整句听写 · ${esc(sentenceSourceLabel(entry))}</div><button id="wholeIgnore" class="retire">${st.status==='ignored'?'恢复本句':'忽略本句'}</button></div><div class="studybody" style="max-width:820px"><span class="sentence-state ${st.status}">${st.label}</span><button id="wholeSpeak" class="speaker">◖))</button>${!run.revealed?`<div class="small">先听完整句子，再把整句写下来。标点不参与对错；按单词顺序做对齐。</div><textarea id="wholeSentenceAnswer" class="whole-answer" placeholder="输入你听到的完整英文句子…" autocomplete="off" autocapitalize="off">${esc(run.input)}</textarea><div class="grid2" style="width:100%;max-width:720px;margin-top:10px"><button id="wholeSubmit" class="primary">提交整句</button><button id="wholeReveal" class="soft">看原句</button></div>`:`${run.peek?`<div class="small">本次直接看了原句，这句标记为“需重练”。</div><div class="sentence" style="max-width:720px">${esc(entry.text)}</div>`:`<div class="small">${run.alignment?.correct?'整句正确':'按单词对齐结果如下'}</div>${wholeDiffHtml(run.alignment)}<div class="typed" style="max-width:720px"><b>你写的是</b><div>${esc(run.input||'（空）')}</div></div>`}<div class="sentence-mode-row" style="justify-content:center"><button id="wholeReplay" class="soft">重听整句</button><button id="wholeRedoSplit" class="soft">重做本句拆词</button>${problems.length?`<button id="wholeProblems" class="soft">只练错词 · ${problems.length}</button>`:''}<button id="wholeRetry" class="primary">再写一次整句</button><button id="wholeFinish" class="soft">返回</button></div>`}</div></main>`;
  document.getElementById('wholeBack').onclick=()=>returnFromWholeSentenceRun(run);document.getElementById('wholeSpeak').onclick=()=>speak(entry.text);document.getElementById('wholeIgnore').onclick=()=>{setSentencePracticeStatus(entry,st.status==='ignored'?'unseen':'ignored');persist();renderWholeSentenceRun();};
  if(!run.revealed){const input=document.getElementById('wholeSentenceAnswer');input.focus();document.getElementById('wholeSubmit').onclick=()=>{run.input=input.value.trim();if(!run.input)return toast('没写内容的话点“看原句”');run.alignment=alignSentenceInput(entry.text,run.input);applyWholeAlignment(entry,run.alignment);recordWholeSentenceAttempt(entry,{input:run.input,alignment:run.alignment,revealed:false});run.revealed=true;persist();renderWholeSentenceRun();};document.getElementById('wholeReveal').onclick=()=>{run.input=input.value.trim();run.peek=true;run.revealed=true;recordWholeSentenceAttempt(entry,{input:run.input,revealed:true});persist();renderWholeSentenceRun();};}
  else{document.getElementById('wholeReplay').onclick=()=>speak(entry.text);document.getElementById('wholeRedoSplit').onclick=()=>{const ret=run.returnTextId;wholeSentenceRun=null;startSavedEntryDictation(book.id,entry.id,{onlyProblems:false,unique:false,returnTextId:ret});};if(document.getElementById('wholeProblems'))document.getElementById('wholeProblems').onclick=()=>{const ret=run.returnTextId;wholeSentenceRun=null;startSavedEntryDictation(book.id,entry.id,{onlyProblems:true,unique:true,returnTextId:ret});};document.getElementById('wholeRetry').onclick=()=>{run.input='';run.alignment=null;run.revealed=false;run.peek=false;renderWholeSentenceRun();speak(entry.text);};document.getElementById('wholeFinish').onclick=()=>returnFromWholeSentenceRun(run);}
}

'''
s = s[:insert_at] + whole_engine + s[insert_at:]

# Stable sourceSentenceId in split dictation and linked text sentences.
s = replace_once(s,
    "const saved=addSentenceEntry(state,{bookName:bookName||'句子词库',text,tokens:allTokens,sourceTextId:meta.sourceTextId||null,sourceTitle:meta.sourceTitle||'',sourceCollection:meta.sourceCollection||'',sentenceIndex:meta.sentenceIndex??null});persist();",
    "const saved=addSentenceEntry(state,{bookName:bookName||'句子词库',text,tokens:allTokens,sourceTextId:meta.sourceTextId||null,sourceSentenceId:meta.sourceSentenceId||null,sourceTitle:meta.sourceTitle||'',sourceCollection:meta.sourceCollection||'',sentenceIndex:meta.sentenceIndex??null});persist();",
    'split source stable id')
s = sub_once(s,
    r"function startLinkedSentenceDictation\(text,sentence,sentenceIndex\)\{.*?\}\nfunction startSavedEntryDictation",
    "function startLinkedSentenceDictation(text,sentenceRecord,sentenceIndex){const bookName=`${text.collection||'文本'} · 句子`;startSentenceDictation(sentenceRecord.text,false,bookName,{sourceTextId:text.id,sourceSentenceId:sentenceRecord.id,sourceTitle:text.title,sourceCollection:text.collection||'未分类',sentenceIndex,returnTextId:text.id,label:`${text.title} · 第 ${sentenceIndex+1} 句`});}\nfunction startSavedEntryDictation",
    'linked split stable sentence')

# Sentence split completion updates the sentence-level state.
start = s.index('function finishSentenceRun(){')
end = s.index('\nfunction drawTextList()', start)
old_finish = s[start:end]
# Keep the existing finish UI but prepend state recomputation.
new_finish = old_finish.replace("function finishSentenceRun(){const run=sentenceRun;if(!run)return;", "function finishSentenceRun(){const run=sentenceRun;if(!run)return;const touched=new Set((run.items||[]).map(item=>`${item.bookId}|${item.entryId}`));for(const key of touched){const [bookId,entryId]=key.split('|');const {entry}=getSentenceEntry(state,bookId,entryId);if(!entry||deriveSentencePracticeStatus(entry)==='ignored')continue;const remain=sentenceProblemTokens(entry).filter(token=>!isSimpleLexeme(state,token.normalized||token.surface));setSentencePracticeStatus(entry,remain.length?'repeat':'done');}persist();")
s = s[:start] + new_finish + s[end:]

# Stable text sentence records on save/edit.
s = sub_once(s,
    r"function saveTextItem\(\)\{.*?\}\nfunction renderTextReader\(\)\{",
    """function saveTextItem(){const title=document.getElementById('textTitle').value.trim(),collection=document.getElementById('textCollection').value.trim()||'未分类',body=document.getElementById('textBody').value.trim();if(!title||!body)return toast('标题和正文都要填');const now=Date.now();if(textEditId){const t=state.texts.find(x=>x.id===textEditId);Object.assign(t,{title,collection,body,updatedAt:now});reconcileTextSentences(t);}else{const t={id:uid('text'),title,collection,body,createdAt:now,updatedAt:now,lastOpened:0,sentence:0,currentSentenceId:null,hidden:false,loop:false,sentences:[]};reconcileTextSentences(t);state.texts.unshift(t);}textEditId=null;textFormOpen=false;persist();renderText();}
function renderTextReader(){""",
    'save text stable sentences')

# Replace reader with stable sentence IDs and true whole-sentence action.
start = s.index('function renderTextReader(){')
end = s.index('\nfunction speakSentence', start)
new_reader = r'''function renderTextReader(){
  const t=state.texts.find(x=>x.id===textReaderId);if(!t){textReaderId=null;return renderText();}
  const ss=reconcileTextSentences(t);if(!ss.length)return toast('这篇文本没有可练的句子');let idx=t.currentSentenceId?ss.findIndex(row=>row.id===t.currentSentenceId):-1;if(idx<0)idx=Math.max(0,Math.min(ss.length-1,t.sentence||0));const sentenceRecord=ss[idx],sentence=sentenceRecord.text;t.sentence=idx;t.currentSentenceId=sentenceRecord.id;const source=`${t.collection||'未分类'} · ${t.title}`;
  const linkedEntries=state.sentenceBooks.flatMap(book=>(book.entries||[]).map(entry=>({book,entry}))).filter(row=>row.entry.sourceTextId===t.id&&((row.entry.sourceSentenceId&&row.entry.sourceSentenceId===sentenceRecord.id)||(!row.entry.sourceSentenceId&&Number(row.entry.sentenceIndex)===Number(idx))));
  const linkedRows=findSentenceProblemEntries(state).filter(row=>row.entry.sourceTextId===t.id&&((row.entry.sourceSentenceId&&row.entry.sourceSentenceId===sentenceRecord.id)||(!row.entry.sourceSentenceId&&Number(row.entry.sentenceIndex)===Number(idx)))).map(row=>({...row,problems:row.problems.filter(token=>!isSimpleLexeme(state,token.normalized||token.surface))})).filter(row=>row.problems.length);
  const linkedProblemCount=new Set(linkedRows.flatMap(row=>row.problems.map(token=>token.normalized||String(token.surface).toLowerCase()))).size;const sentenceState=linkedEntries.length?sentenceStateInfo(linkedEntries[0].entry):{status:'unseen',label:'未练'};
  root.innerHTML=`<main class="immersive"><div class="studytop"><button id="textBack" class="back">‹</button><div class="studyprogress">${esc(t.title)} · 第 ${idx+1}/${ss.length} 句<br><span class="small">${esc(t.collection||'未分类')}</span></div><button id="textEdit" class="retire">编辑</button></div><div class="reader"><div class="sentence-entry-meta" style="justify-content:center"><span class="sentence-state ${sentenceState.status}">${sentenceState.label}</span>${linkedProblemCount?`<span class="small">错词 ${linkedProblemCount}</span>`:''}</div><div class="reader-actions"><button id="playFull" class="soft">全文朗读</button><button id="toggleText" class="soft">${t.hidden?'显示原文':'隐藏原文'}</button><button id="toggleLoop" class="soft">单句循环 ${t.loop?'开':'关'}</button><button id="dictateWholeSentence" class="primary">整句听写</button><button id="dictateSentence" class="soft">拆词听写</button>${linkedProblemCount?`<button id="dictateSentenceProblems" class="soft">本句错词 · ${linkedProblemCount}</button>`:''}</div><div class="sentence ${t.hidden?'blur':''}">${esc(sentence)}</div><div class="sentence-nav"><button id="prevSentence" class="soft" ${idx===0?'disabled':''}>上一句</button><button id="playSentence" class="primary">重听本句</button><button id="nextSentence" class="soft" ${idx===ss.length-1?'disabled':''}>下一句</button></div><section class="card" style="margin-top:14px"><h3 style="margin-top:0">全文</h3><div id="fullText" class="fulltext ${t.hidden?'blur':''}">${esc(t.body)}</div></section><section class="card" style="margin-top:14px"><h3 style="margin-top:0">从本文加入单词</h3><div class="small">来源会保存为「${esc(source)}」，例句默认保存当前句。</div><div class="grid2" style="margin-top:10px"><input id="textWord" placeholder="英文单词"><input id="textZh" placeholder="中文核心义，可留空"></div><div class="row" style="margin-top:10px"><button id="useSelection" class="soft">使用选中的词</button><button id="addFromText" class="primary">加入词库</button></div></section></div></main>`;
  document.getElementById('textBack').onclick=()=>{speechSynthesis.cancel();textReaderId=null;view='text';renderText();};document.getElementById('textEdit').onclick=()=>{speechSynthesis.cancel();textEditId=t.id;textFormOpen=true;textReaderId=null;renderText();};document.getElementById('playFull').onclick=()=>speak(t.body);document.getElementById('playSentence').onclick=()=>speakSentence(t,sentence);document.getElementById('dictateWholeSentence').onclick=()=>startWholeSentenceFromText(t,sentenceRecord,idx);document.getElementById('dictateSentence').onclick=()=>startLinkedSentenceDictation(t,sentenceRecord,idx);if(document.getElementById('dictateSentenceProblems'))document.getElementById('dictateSentenceProblems').onclick=()=>startSentenceProblemRows(linkedRows,true,`${t.title} · 第 ${idx+1} 句错词`,t.id);document.getElementById('prevSentence').onclick=()=>{const next=ss[idx-1];t.sentence=idx-1;t.currentSentenceId=next.id;persist();renderTextReader();speak(next.text);};document.getElementById('nextSentence').onclick=()=>{const next=ss[idx+1];t.sentence=idx+1;t.currentSentenceId=next.id;persist();renderTextReader();speak(next.text);};document.getElementById('toggleText').onclick=()=>{t.hidden=!t.hidden;persist();renderTextReader();};document.getElementById('toggleLoop').onclick=()=>{t.loop=!t.loop;persist();renderTextReader();if(t.loop)speakSentence(t,sentence);else speechSynthesis.cancel();};document.getElementById('useSelection').onclick=()=>{const x=String(window.getSelection?.().toString()||'').trim().replace(/^[^A-Za-z'’-]+|[^A-Za-z'’-]+$/g,'');if(!x||/\s/.test(x))return toast('先只选中一个英文单词');document.getElementById('textWord').value=x;};document.getElementById('addFromText').onclick=()=>addWordFromText(source,sentence);persist();
}'''
s = s[:start] + new_reader + s[end:]

p.write_text(s)
print('applied sentence engine v9')
