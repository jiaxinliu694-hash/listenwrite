from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        if new in text:
            return
        raise SystemExit(f'expected marker not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


# Data layer: one word-level edit updates only practiced occurrences in this text,
# uses the canonical manual-status setter, and therefore clears legacy-candidate flags.
replace_once(
    'src/textlibrary.js',
    "import { isSimpleLexeme, normalizeLexeme } from './sentencebooks.js';",
    "import { isSimpleLexeme, normalizeLexeme, setSentenceTokenStatus } from './sentencebooks.js';",
)

textlib = Path('src/textlibrary.js')
text = textlib.read_text()
marker = "export function textCollectionUnfamiliarTokens(state, collection) {"
helper = """export function setTextLexemeStatus(state, textId, lexeme, status) {
  const key = normalizeLexeme(lexeme);
  const nextStatus = status === 'unknown' ? 'unfamiliar' : status;
  if (!key || !['familiar', 'unfamiliar'].includes(nextStatus)) return 0;
  let changed = 0;
  for (const { entry } of linkedTextEntries(state, textId)) {
    for (let tokenIndex = 0; tokenIndex < (entry.tokens || []).length; tokenIndex += 1) {
      const token = entry.tokens[tokenIndex];
      if (normalizeLexeme(token?.normalized || token?.surface) !== key) continue;
      const attempts = Array.isArray(token?.attempts) ? token.attempts : [];
      const practiced = attempts.length > 0 || ['familiar', 'unfamiliar', 'unknown'].includes(token?.status) || Boolean(token?.legacyUnfamiliarCandidate);
      if (!practiced) continue;
      if (setSentenceTokenStatus(entry, tokenIndex, nextStatus)) changed += 1;
    }
  }
  return changed;
}

"""
if helper not in text:
    if marker not in text:
        raise SystemExit('textlibrary insertion marker missing')
    text = text.replace(marker, helper + marker, 1)
    textlib.write_text(text)

# UI import and transient open state.
replace_once(
    'src/app.js',
    "import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textLegacyUnfamiliarCandidates, textCollectionUnfamiliarTokens, textCollectionSummaries } from './textlibrary.js';",
    "import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textLegacyUnfamiliarCandidates, setTextLexemeStatus, textCollectionUnfamiliarTokens, textCollectionSummaries } from './textlibrary.js';",
)
replace_once(
    'src/app.js',
    "let textLibraryDetailId = null;\nlet textToolsOpen = false;",
    "let textLibraryDetailId = null;\nlet textLegacyPanelOpen = false;\nlet textToolsOpen = false;",
)
replace_once(
    'src/app.js',
    "document.querySelectorAll('[data-text-history]').forEach(b=>b.onclick=()=>{textLibraryDetailId=b.dataset.textHistory;renderText();});",
    "document.querySelectorAll('[data-text-history]').forEach(b=>b.onclick=()=>{textLibraryDetailId=b.dataset.textHistory;textLegacyPanelOpen=false;renderText();});",
)

app = Path('src/app.js')
s = app.read_text()
start = s.find('function renderTextLibraryDetail(){')
end = s.find('\nfunction renderText(){', start)
if start < 0 or end < 0:
    raise SystemExit('renderTextLibraryDetail block not found')
new_function = r'''function renderTextLibraryDetail(){
  const t=state.texts.find(x=>x.id===textLibraryDetailId);if(!t){textLibraryDetailId=null;return renderText();}
  const sentences=linkedTextEntries(state,t.id,{practicedOnly:true});const words=textPracticeWords(state,t.id);const unfamiliar=textUnfamiliarTokens(state,t.id);const legacyCandidates=textLegacyUnfamiliarCandidates(state,t.id);
  const legacySection=legacyCandidates.length?`<section class="card"><details id="legacyCandidatePanel" ${textLegacyPanelOpen?'open':''}><summary><b>整理旧版不熟候选 · ${legacyCandidates.length}</b></summary><div class="small" style="margin:10px 0 12px">旧版本曾把拼写结果和熟悉度混在一起，所以这些只能恢复成“候选”。在这里确认一次「熟悉 / 不熟悉 / 简单」后，它就会退出候选，并进入现在的正式状态。</div><div class="list">${legacyCandidates.map(w=>`<div class="listitem compact-word"><div class="space"><div><div class="word-main"><b>${esc(w.surface)}</b><span class="tag">待确认</span></div>${w.sentence?`<div class="small">${esc(w.sentence)}</div>`:''}</div><div class="toolbar"><button class="soft" data-legacy-status="familiar" data-legacy-word="${esc(w.normalized)}">熟悉</button><button class="soft" data-legacy-status="unfamiliar" data-legacy-word="${esc(w.normalized)}">不熟悉</button><button class="ghost" data-legacy-simple="${esc(w.normalized)}">标记简单</button></div></div></div>`).join('')}</div></details></section>`:'';
  const wordRows=words.length?words.map(w=>`<div class="listitem compact-word"><div class="space"><div><div class="word-main"><b>${esc(w.surface)}</b><span class="tag">${textHistoryStatusLabel(w.status)}</span></div><div class="small">出现 ${w.occurrences.length} 次</div></div>${w.simple?`<button class="soft" data-restore-simple="${esc(w.lexeme)}">恢复</button>`:`<div class="toolbar"><button class="${w.status==='familiar'?'goodbtn':'soft'}" data-text-word-status="familiar" data-text-word="${esc(w.lexeme)}">熟悉</button><button class="${w.status==='unfamiliar'?'badbtn':'soft'}" data-text-word-status="unfamiliar" data-text-word="${esc(w.lexeme)}">不熟悉</button><button class="ghost" data-mark-simple="${esc(w.lexeme)}">标记简单</button></div>`}</div></div>`).join(''):'<div class="empty">这篇文本还没有拆词记录。</div>';
  shell(`<div class="stack"><section class="card"><button id="backTextCollection" class="ghost">‹ ${esc(t.collection||'未分类')}</button><h2 class="section-title" style="margin-top:8px">${esc(t.title)}</h2><div class="small">学习记录只显示这篇文本产生并实际练过的句子和单词；熟悉度可以在这里直接修改。</div><div class="grid3" style="margin-top:14px"><div class="statbox"><b>${sentences.length}</b><span>听过的句子</span></div><div class="statbox"><b>${words.length}</b><span>听过的单词</span></div><div class="statbox"><b>${words.filter(w=>w.simple).length}</b><span>标记简单</span></div></div><div class="toolbar" style="margin-top:12px"><button id="continueText" class="primary">继续听文本</button><button id="exportTextUnfamiliar" class="soft" ${unfamiliar.length?'':'disabled'}>导出当前不熟悉 · ${unfamiliar.length}</button>${legacyCandidates.length?`<button id="exportLegacyUnfamiliar" class="soft">导出旧版候选 · ${legacyCandidates.length}</button>`:''}</div></section>${legacySection}<section class="card"><h2 class="section-title">听过的句子</h2><div class="list" style="margin-top:12px">${sentences.length?sentences.map(({book,entry})=>{const st=sentenceStateInfo(entry);return`<div class="sentence-entry"><div class="sentence-entry-meta"><span class="sentence-state ${st.whole.status}">整句 ${st.whole.label}</span><span class="sentence-state ${st.split.status}">拆词 ${st.split.label}</span><span class="small">第 ${Number(entry.sentenceIndex||0)+1} 句</span></div><div class="sentence-entry-text">${esc(entry.text)}</div><div class="sentence-mode-row"><button class="soft" data-history-whole="${book.id}|${entry.id}">整句听写</button><button class="soft" data-history-split="${book.id}|${entry.id}">拆词听写</button></div></div>`}).join(''):'<div class="empty">这篇文本还没有练过句子。</div>'}</div></section><section class="card"><h2 class="section-title">听过的单词</h2><div class="small">这里改「熟悉 / 不熟悉」只改这篇文本已经练过的记录，不会制造新的拼写成绩；“简单”仍是全局词状态。</div><div class="list" style="margin-top:12px">${wordRows}</div></section></div>`);
  const rerenderKeepingScroll=()=>{const y=window.scrollY||0;renderTextLibraryDetail();requestAnimationFrame(()=>window.scrollTo(0,y));};
  const setWordStatus=(lexeme,status)=>{const changed=setTextLexemeStatus(state,t.id,lexeme,status);if(!changed)return toast('没有找到可修改的练习记录');persist();toast(status==='unfamiliar'?'已改为不熟悉':'已改为熟悉');rerenderKeepingScroll();};
  const markWordSimple=(lexeme)=>{setTextLexemeStatus(state,t.id,lexeme,'familiar');markSimpleLexeme(state,lexeme,true);persist();toast('已标记简单');rerenderKeepingScroll();};
  document.getElementById('backTextCollection').onclick=()=>{textLibraryDetailId=null;textLegacyPanelOpen=false;textLibraryCollection=t.collection||'未分类';renderText();};
  document.getElementById('continueText').onclick=()=>{textReaderId=t.id;t.lastOpened=Date.now();persist();renderTextReader();};
  document.getElementById('exportTextUnfamiliar').onclick=()=>{if(!unfamiliar.length)return;const source=`${t.collection||'未分类'} · ${t.title} · 当前不熟悉`;const safe=String(t.title||'文本').replace(/[\/:*?"<>|]+/g,'-');download(`${safe}-当前不熟悉-${currentDayKey()}.csv`,problemTokensToCSV(unfamiliar,{source}),'text/csv;charset=utf-8');toast(`已导出 ${unfamiliar.length} 个当前不熟悉词`);};
  if(document.getElementById('exportLegacyUnfamiliar'))document.getElementById('exportLegacyUnfamiliar').onclick=()=>{const source=`${t.collection||'未分类'} · ${t.title} · 旧版不熟候选`;const safe=String(t.title||'文本').replace(/[\/:*?"<>|]+/g,'-');download(`${safe}-旧版不熟候选-${currentDayKey()}.csv`,problemTokensToCSV(legacyCandidates,{source}),'text/csv;charset=utf-8');toast(`已导出 ${legacyCandidates.length} 个旧版不熟候选`);};
  const legacyPanel=document.getElementById('legacyCandidatePanel');if(legacyPanel)legacyPanel.ontoggle=()=>{textLegacyPanelOpen=legacyPanel.open;};
  document.querySelectorAll('[data-legacy-status]').forEach(b=>b.onclick=()=>{textLegacyPanelOpen=true;setWordStatus(b.dataset.legacyWord,b.dataset.legacyStatus);});
  document.querySelectorAll('[data-legacy-simple]').forEach(b=>b.onclick=()=>{textLegacyPanelOpen=true;markWordSimple(b.dataset.legacySimple);});
  document.querySelectorAll('[data-text-word-status]').forEach(b=>b.onclick=()=>setWordStatus(b.dataset.textWord,b.dataset.textWordStatus));
  document.querySelectorAll('[data-mark-simple]').forEach(b=>b.onclick=()=>markWordSimple(b.dataset.markSimple));
  document.querySelectorAll('[data-history-whole]').forEach(b=>b.onclick=()=>{const [bookId,entryId]=b.dataset.historyWhole.split('|');startWholeSentenceEntry(bookId,entryId,{returnTextId:t.id});});
  document.querySelectorAll('[data-history-split]').forEach(b=>b.onclick=()=>{const [bookId,entryId]=b.dataset.historySplit.split('|');startSavedEntryDictation(bookId,entryId,{returnTextId:t.id});});
  document.querySelectorAll('[data-restore-simple]').forEach(b=>b.onclick=()=>{const y=window.scrollY||0;markSimpleLexeme(state,b.dataset.restoreSimple,false);persist();toast('已恢复，会重新进入相关练习');renderTextLibraryDetail();requestAnimationFrame(()=>window.scrollTo(0,y));});
}'''
s = s[:start] + new_function + s[end:]
app.write_text(s)

# Browser cache bust and regression expectations.
replace_once('index.html', 'app.bundle.js?v=31-openable-csv', 'app.bundle.js?v=32-edit-text-status')
for test_path in ['tests/v23_1.test.js', 'tests/v24.test.js']:
    p = Path(test_path)
    t = p.read_text().replace("app.bundle.js?v=31", "app.bundle.js?v=32")
    p.write_text(t)

v32 = Path('tests/v32.test.js')
v32.write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeSentenceBooks } from '../src/sentencebooks.js';
import { setTextLexemeStatus, textLegacyUnfamiliarCandidates, textUnfamiliarTokens } from '../src/textlibrary.js';

function legacyState() {
  return {
    texts: [{id:'t1',title:'Test1Part4'},{id:'t2',title:'Other'}],
    words: [],
    simpleWords: [],
    sentenceBooks: normalizeSentenceBooks([{id:'b',entries:[
      {id:'e1',sourceTextId:'t1',text:'Collars were fitted.',tokens:[{surface:'Collars',normalized:'collars',status:'familiar',attempts:[{ts:1,spellingResult:'bad',status:'unfamiliar'},{ts:2,spellingResult:'good',status:'familiar'}]}]},
      {id:'e2',sourceTextId:'t1',text:'The collars helped.',tokens:[{surface:'collars',normalized:'collars',status:'familiar',attempts:[{ts:3,spellingResult:'good',status:'familiar'}]}]},
      {id:'e3',sourceTextId:'t2',text:'Other collars.',tokens:[{surface:'collars',normalized:'collars',status:'familiar',attempts:[{ts:4,spellingResult:'bad',status:'unfamiliar'}]}]},
    ]}]),
  };
}

test('legacy candidate can be confirmed unfamiliar in-app without inventing spelling attempts',()=>{
  const state=legacyState();
  assert.deepEqual(textLegacyUnfamiliarCandidates(state,'t1').map(x=>x.normalized),['collars']);
  const before=state.sentenceBooks[0].entries[0].tokens[0].attempts.length;
  assert.equal(setTextLexemeStatus(state,'t1','collars','unfamiliar'),2);
  assert.equal(state.sentenceBooks[0].entries[0].tokens[0].attempts.length,before);
  assert.equal(textLegacyUnfamiliarCandidates(state,'t1').length,0);
  assert.deepEqual(textUnfamiliarTokens(state,'t1').map(x=>x.normalized),['collars']);
  assert.equal(textLegacyUnfamiliarCandidates(state,'t2').length,1,'editing one text must not rewrite another text');
});

test('legacy candidate can be confirmed familiar and leave both candidate and unfamiliar pools',()=>{
  const state=legacyState();
  assert.equal(setTextLexemeStatus(state,'t1','collars','familiar'),2);
  assert.equal(textLegacyUnfamiliarCandidates(state,'t1').length,0);
  assert.equal(textUnfamiliarTokens(state,'t1').length,0);
});

test('text learning history exposes direct familiar/unfamiliar/simple editing and candidate triage',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes('data-text-word-status'));
  assert.ok(app.includes('data-legacy-status'));
  assert.ok(app.includes('整理旧版不熟候选'));
  assert.ok(app.includes('setTextLexemeStatus(state,t.id'));
  assert.ok(app.includes('data-mark-simple'));
});
""")
