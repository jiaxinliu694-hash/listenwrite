from pathlib import Path
import re


def patch(path, edits):
    p = Path(path)
    text = p.read_text()
    original = text
    for label, pattern, replacement, regex in edits:
        if regex:
            new, count = re.subn(pattern, lambda m, r=replacement: r, text, count=1, flags=re.S)
        else:
            count = text.count(pattern)
            new = text.replace(pattern, replacement, 1)
            count = 1 if count else 0
        if count != 1:
            raise RuntimeError(f'{path}: {label}: expected 1 match, got {count}')
        text = new
    if text == original:
        raise RuntimeError(f'{path}: no changes')
    p.write_text(text)


patch('src/tokenizer.js', [
('numeric equivalence', r"function numericCanonical\(value\)\{.*?\n\}\n\nexport function spellingMatches\(input, answer\) \{.*?\n\}", '''export function numericCanonicals(value){
  const s=normalizeToken(value).replace(/[–—]/g,'-').replace(/,/g,'').trim();
  const out=new Set();
  let m=s.match(/^£\\s*(\\d+(?:\\.\\d+)?)$/); if(m){out.add('gbp:'+Number(m[1]));return [...out];}
  m=s.match(/^(.*?)\\s*(?:pounds?|gbp)$/); if(m){const n=numericValue(m[1]);if(n!=null){out.add('gbp:'+n);return [...out];}}
  m=s.match(/^\\$\\s*(\\d+(?:\\.\\d+)?)$/); if(m){out.add('usd:'+Number(m[1]));return [...out];}
  m=s.match(/^(.*?)\\s*(?:dollars?|usd)$/); if(m){const n=numericValue(m[1]);if(n!=null){out.add('usd:'+n);return [...out];}}
  m=s.match(/^(\\d+(?:\\.\\d+)?)%$/); if(m){out.add('pct:'+Number(m[1]));return [...out];}
  m=s.match(/^(.*?)\\s*(?:percent|per cent)$/); if(m){const n=numericValue(m[1]);if(n!=null){out.add('pct:'+n);return [...out];}}
  m=s.match(/^(\\d{1,2}):(\\d{1,2})$/); if(m){out.add('time:'+Number(m[1])+':'+String(Number(m[2])).padStart(2,'0'));return [...out];}
  m=s.match(/^(\\d+)(?:st|nd|rd|th)$/); if(m){out.add('ord:'+Number(m[1]));return [...out];}
  if(s in ORDINAL){out.add('ord:'+ORDINAL[s]);return [...out];}
  const n=numericValue(s); if(n!=null)out.add('num:'+n);
  m=s.match(/^(.*?)\\s+(.*?)$/); if(m){const h=numericValue(m[1]),min=numericValue(m[2]);if(h!=null&&min!=null&&h<=24&&min<60)out.add('time:'+h+':'+String(min).padStart(2,'0'));}
  return [...out];
}

export function numericCanonical(value){return numericCanonicals(value)[0]||null;}

export function spellingMatches(input, answer) {
  if (normalizeToken(input) === normalizeToken(answer)) return true;
  const a=numericCanonicals(answer), b=numericCanonicals(input);
  if(!a.length||!b.length)return false;
  const wanted=new Set(a);
  return b.some(value=>wanted.has(value));
}''', True),
])

patch('src/textsentences.js', [
('import spelling matcher', "import { tokenizeEnglish } from './tokenizer.js';", "import { tokenizeEnglish, spellingMatches } from './tokenizer.js';", False),
('span-aware alignment', r"export function alignSentenceInput\(expectedText, actualText\) \{.*?\n\}", '''export function alignSentenceInput(expectedText, actualText) {
  const expected = tokenizeEnglish(expectedText);
  const actual = tokenizeEnglish(actualText);
  const rows = expected.length + 1;
  const cols = actual.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  const back = Array.from({ length: rows }, () => Array(cols).fill(null));
  dp[0][0] = 0;
  const consider = (i, j, cost, step) => {
    const current = dp[i][j];
    const preferEqual = cost === current && step.type === 'equal' && back[i][j]?.type !== 'equal';
    if (cost < current || preferEqual) { dp[i][j] = cost; back[i][j] = step; }
  };
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      if (i === 0 && j === 0) continue;
      if (i > 0) consider(i, j, dp[i - 1][j] + 1, {type:'missing',expected:expected[i-1],actual:'',expectedIndex:i-1,actualIndex:null,expectedIndexes:[i-1],actualIndexes:[],prevI:i-1,prevJ:j});
      if (j > 0) consider(i, j, dp[i][j - 1] + 1, {type:'extra',expected:'',actual:actual[j-1],expectedIndex:null,actualIndex:j-1,expectedIndexes:[],actualIndexes:[j-1],prevI:i,prevJ:j-1});
      if (i > 0 && j > 0) {
        const equal = spellingMatches(actual[j - 1], expected[i - 1]);
        consider(i, j, dp[i-1][j-1] + (equal ? 0 : 1), {type:equal?'equal':'replace',expected:expected[i-1],actual:actual[j-1],expectedIndex:i-1,actualIndex:j-1,expectedIndexes:[i-1],actualIndexes:[j-1],prevI:i-1,prevJ:j-1});
      }
      for (let es = 1; es <= Math.min(4, i); es += 1) for (let as = 1; as <= Math.min(4, j); as += 1) {
        if (es + as <= 2 || (es > 1 && as > 1)) continue;
        const ei=i-es, aj=j-as, eSurface=expected.slice(ei,i).join(' '), aSurface=actual.slice(aj,j).join(' ');
        if (!spellingMatches(aSurface,eSurface)) continue;
        consider(i,j,dp[ei][aj],{type:'equal',expected:eSurface,actual:aSurface,expectedIndex:es===1?ei:null,actualIndex:as===1?aj:null,expectedIndexes:Array.from({length:es},(_,k)=>ei+k),actualIndexes:Array.from({length:as},(_,k)=>aj+k),prevI:ei,prevJ:aj});
      }
    }
  }
  const operations=[]; let i=expected.length,j=actual.length;
  while(i>0||j>0){const step=back[i][j];if(!step)throw new Error('Sentence alignment path missing');const {prevI,prevJ,...op}=step;operations.push(op);i=prevI;j=prevJ;}
  operations.reverse();
  const wrongExpectedIndexes=[...new Set(operations.filter(op=>op.type==='replace'||op.type==='missing').flatMap(op=>op.expectedIndexes||(Number.isInteger(op.expectedIndex)?[op.expectedIndex]:[])))];
  return {expected,actual,normalizedExpected:normalizedWords(expectedText),normalizedActual:normalizedWords(actualText),operations,distance:dp[expected.length][actual.length],correct:dp[expected.length][actual.length]===0,wrongExpectedIndexes};
}''', True),
])

patch('src/sentencebooks.js', [
('mode status constant', "const VALID_PRACTICE_STATUS = new Set(['unseen', 'repeat', 'done', 'ignored']);", "const VALID_PRACTICE_STATUS = new Set(['unseen', 'repeat', 'done', 'ignored']);\nconst VALID_MODE_STATUS = new Set(['unseen', 'repeat', 'done']);", False),
('new entry mode status', "    practiceStatus: 'unseen',\n    wholeAttempts: [],", "    practiceStatus: 'unseen',\n    wholeStatus: 'unseen',\n    splitStatus: 'unseen',\n    wholeAttempts: [],", False),
('deletion helpers', r"export function getSentenceEntry\(state, bookId, entryId\) \{.*?\n\}", '''export function getSentenceEntry(state, bookId, entryId) {
  const book = ensureSentenceBooks(state).find((b) => b.id === bookId);
  const entry = book?.entries?.find((e) => e.id === entryId) || null;
  return { book: book || null, entry };
}

export function deleteSentenceEntry(state, bookId, entryId) {
  const book = ensureSentenceBooks(state).find((b) => b.id === bookId);
  if (!book) return { deleted:false, removedEntries:0 };
  const before=(book.entries||[]).length;
  book.entries=(book.entries||[]).filter((entry)=>entry.id!==entryId);
  const removedEntries=before-book.entries.length;
  if(removedEntries)book.updatedAt=Date.now();
  return { deleted:Boolean(removedEntries), removedEntries };
}

export function deleteSentenceBook(state, bookId) {
  const books=ensureSentenceBooks(state), book=books.find((candidate)=>candidate.id===bookId);
  if(!book)return {deleted:false,removedEntries:0};
  const removedEntries=(book.entries||[]).length;
  state.sentenceBooks=books.filter((candidate)=>candidate.id!==bookId);
  return {deleted:true,removedEntries};
}''', True),
('separate practice status', r"export function deriveSentencePracticeStatus\(entry\) \{.*?\n\}\n\nexport function setSentencePracticeStatus\(entry, status\) \{.*?\n\}\n\nexport function recordWholeSentenceAttempt\(entry, \{ input = '', alignment = null, revealed = false \} = \{\}\) \{.*?\n\}", '''function inferWholeStatus(entry){const attempts=Array.isArray(entry?.wholeAttempts)?entry.wholeAttempts:[];if(!attempts.length)return 'unseen';return attempts.at(-1)?.correct?'done':'repeat';}
function inferSplitStatus(entry){const tokens=Array.isArray(entry?.tokens)?entry.tokens:[];if(!tokens.some(token=>Array.isArray(token.attempts)&&token.attempts.length))return 'unseen';return tokens.some(token=>token.status==='unfamiliar'||token.status==='unknown')?'repeat':'done';}
export function deriveWholeSentenceStatus(entry){if(!entry)return'unseen';if(entry.practiceStatus==='ignored')return'ignored';return VALID_MODE_STATUS.has(entry.wholeStatus)?entry.wholeStatus:inferWholeStatus(entry);}
export function deriveSplitSentenceStatus(entry){if(!entry)return'unseen';if(entry.practiceStatus==='ignored')return'ignored';return VALID_MODE_STATUS.has(entry.splitStatus)?entry.splitStatus:inferSplitStatus(entry);}
export function deriveSentencePracticeStatus(entry){if(!entry)return'unseen';if(entry.practiceStatus==='ignored')return'ignored';const whole=deriveWholeSentenceStatus(entry),split=deriveSplitSentenceStatus(entry);if(whole==='repeat'||split==='repeat')return'repeat';if(whole==='done'||split==='done')return'done';return'unseen';}
export function setSentencePracticeStatus(entry,status){if(!entry||!VALID_PRACTICE_STATUS.has(status))return null;entry.practiceStatus=status==='ignored'?'ignored':'unseen';entry.lastPracticedAt=Date.now();entry.updatedAt=Date.now();return deriveSentencePracticeStatus(entry);}
export function setSplitSentencePracticeStatus(entry,status){if(!entry||!VALID_MODE_STATUS.has(status))return null;entry.splitStatus=status;if(entry.practiceStatus!=='ignored')entry.practiceStatus='unseen';entry.lastPracticedAt=Date.now();entry.updatedAt=Date.now();return entry.splitStatus;}
export function recordWholeSentenceAttempt(entry,{input='',alignment=null,revealed=false}={}){if(!entry)return null;entry.wholeAttempts=Array.isArray(entry.wholeAttempts)?entry.wholeAttempts:[];const attempt={ts:Date.now(),input:String(input||''),revealed:Boolean(revealed),correct:Boolean(!revealed&&alignment?.correct),distance:Number(alignment?.distance)||0,operations:Array.isArray(alignment?.operations)?alignment.operations.map(op=>({type:op.type,expected:op.expected||'',actual:op.actual||'',expectedIndex:Number.isInteger(op.expectedIndex)?op.expectedIndex:null,actualIndex:Number.isInteger(op.actualIndex)?op.actualIndex:null})):[]};entry.wholeAttempts.push(attempt);entry.wholeStatus=attempt.correct?'done':'repeat';if(entry.practiceStatus!=='ignored')entry.practiceStatus='unseen';entry.lastPracticedAt=attempt.ts;entry.updatedAt=attempt.ts;return attempt;}''', True),
('normalize mode status', "      practiceStatus: VALID_PRACTICE_STATUS.has(entry.practiceStatus) ? entry.practiceStatus : 'unseen',\n      wholeAttempts: Array.isArray(entry.wholeAttempts) ? entry.wholeAttempts : [],", "      practiceStatus: entry.practiceStatus === 'ignored' ? 'ignored' : 'unseen',\n      wholeStatus: VALID_MODE_STATUS.has(entry.wholeStatus) ? entry.wholeStatus : (Array.isArray(entry.wholeAttempts) && entry.wholeAttempts.length ? (entry.wholeAttempts.at(-1)?.correct ? 'done' : 'repeat') : 'unseen'),\n      splitStatus: VALID_MODE_STATUS.has(entry.splitStatus) ? entry.splitStatus : ((Array.isArray(entry.tokens) ? entry.tokens : []).some(token => Array.isArray(token.attempts) && token.attempts.length) ? ((Array.isArray(entry.tokens) ? entry.tokens : []).some(token => token.status === 'unfamiliar' || token.status === 'unknown') ? 'repeat' : 'done') : (!Array.isArray(entry.wholeAttempts) || !entry.wholeAttempts.length) && (entry.practiceStatus === 'done' || entry.practiceStatus === 'repeat') ? entry.practiceStatus : 'unseen'),\n      wholeAttempts: Array.isArray(entry.wholeAttempts) ? entry.wholeAttempts : [],", False),
])

patch('src/storage.js', [
('sentence session default', "    sentenceBooks: [],\n    simpleWords: [],", "    sentenceBooks: [],\n    sentenceSession: null,\n    simpleWords: [],", False),
('session normalize helper', r"function normalizeActivities\(list, preserveDate\) \{.*?\n\}", '''function normalizeActivities(list, preserveDate) {
  return (Array.isArray(list) ? list : []).map((a) => ({
    ...a,
    date: preserveDate && a.date ? a.date : calendarDayKey(Number(a.start) || Number(a.lastTouch) || Date.now()),
  }));
}
function normalizeSentenceSession(value){
  if(!value||typeof value!=='object')return null;
  const updatedAt=Number(value.updatedAt)||0;
  if(value.mode==='whole'&&value.run?.bookId&&value.run?.entryId)return {mode:'whole',updatedAt,run:{...value.run,input:String(value.run.input||''),revealed:Boolean(value.run.revealed),peek:Boolean(value.run.peek)},queue:(Array.isArray(value.queue)?value.queue:[]).filter(item=>item?.bookId&&item?.entryId).map(item=>({bookId:item.bookId,entryId:item.entryId}))};
  if(value.mode==='split'&&Array.isArray(value.run?.items))return {mode:'split',updatedAt,run:{...value.run,items:value.run.items.filter(item=>item?.bookId&&item?.entryId&&Number.isInteger(Number(item.tokenIndex))).map(item=>({bookId:item.bookId,entryId:item.entryId,tokenIndex:Number(item.tokenIndex)})),cursor:Math.max(0,Number(value.run.cursor)||0),input:String(value.run.input||''),revealed:Boolean(value.run.revealed),completed:Boolean(value.run.completed)}};
  return null;
}''', True),
('normalize session', "  state.sentenceBooks = normalizeSentenceBooks(input?.sentenceBooks);\n  state.simpleWords", "  state.sentenceBooks = normalizeSentenceBooks(input?.sentenceBooks);\n  state.sentenceSession = normalizeSentenceSession(input?.sentenceSession);\n  state.simpleWords", False),
])

app_edits = []
app_edits.append(('imports', "import { ensureSentenceBooks, ensureSimpleWords, isSimpleLexeme, markSimpleLexeme, addSentenceEntry, getSentenceEntry, recordSentenceToken, setSentenceTokenStatus, sentencePracticeIndexes, sentenceProblemTokens, allSentenceProblemTokens, findSentenceProblemEntries, sentenceSourceLabel, problemTokensToTSV, deriveSentencePracticeStatus, setSentencePracticeStatus, recordWholeSentenceAttempt } from './sentencebooks.js';", "import { ensureSentenceBooks, ensureSimpleWords, isSimpleLexeme, markSimpleLexeme, addSentenceEntry, getSentenceEntry, deleteSentenceEntry, deleteSentenceBook, recordSentenceToken, setSentenceTokenStatus, sentencePracticeIndexes, sentenceProblemTokens, allSentenceProblemTokens, findSentenceProblemEntries, sentenceSourceLabel, problemTokensToTSV, deriveSentencePracticeStatus, deriveWholeSentenceStatus, deriveSplitSentenceStatus, setSentencePracticeStatus, setSplitSentencePracticeStatus, recordWholeSentenceAttempt } from './sentencebooks.js';", False))
app_edits.append(('draft globals', "let typeFilterPanelOpen = false;", "let typeFilterPanelOpen = false;\nlet sentenceDraftTimer = null;\nconst SENTENCE_DRAFT_KEY = 'listenwrite-v3-sentence-session-draft';", False))
app_edits.append(('persist session', r"function persist\(\) \{.*?\n\}", '''function syncActiveSentenceSession(){if(!state)return;if(wholeSentenceRun)state.sentenceSession={mode:'whole',updatedAt:Date.now(),run:{...wholeSentenceRun},queue:wholeQueue.map(item=>({...item}))};else if(sentenceRun)state.sentenceSession={mode:'split',updatedAt:Date.now(),run:{...sentenceRun,items:(sentenceRun.items||[]).map(item=>({...item}))}};else state.sentenceSession=null;}
function mirrorSentenceDraft(){try{if(state?.sentenceSession)localStorage.setItem(SENTENCE_DRAFT_KEY,JSON.stringify(state.sentenceSession));else localStorage.removeItem(SENTENCE_DRAFT_KEY);}catch{}}
function scheduleSentenceDraftPersist(){syncActiveSentenceSession();mirrorSentenceDraft();clearTimeout(sentenceDraftTimer);sentenceDraftTimer=setTimeout(()=>persist(),180);}
function restoreSentenceSession(){let saved=state?.sentenceSession||null;try{const local=JSON.parse(localStorage.getItem(SENTENCE_DRAFT_KEY)||'null');if(local&&Number(local.updatedAt||0)>Number(saved?.updatedAt||0))saved=local;}catch{}if(saved?.mode==='whole'&&saved.run?.bookId&&saved.run?.entryId&&getSentenceEntry(state,saved.run.bookId,saved.run.entryId).entry){wholeSentenceRun={...saved.run,input:String(saved.run.input||'')};wholeQueue=(saved.queue||[]).filter(item=>getSentenceEntry(state,item.bookId,item.entryId).entry).map(item=>({...item}));sentenceRun=null;view='text';syncActiveSentenceSession();mirrorSentenceDraft();return'whole';}if(saved?.mode==='split'&&Array.isArray(saved.run?.items)){const items=saved.run.items.filter(item=>getSentenceEntry(state,item.bookId,item.entryId).entry?.tokens?.[item.tokenIndex]);if(items.length){const completed=Boolean(saved.run.completed),cursor=completed?Math.max(items.length,Number(saved.run.cursor)||items.length):Math.min(items.length-1,Math.max(0,Number(saved.run.cursor)||0));sentenceRun={...saved.run,items,cursor,input:String(saved.run.input||''),completed};wholeSentenceRun=null;wholeQueue=[];view='text';syncActiveSentenceSession();mirrorSentenceDraft();return'split';}}state.sentenceSession=null;mirrorSentenceDraft();return null;}
function persist() {
  syncActiveSentenceSession(); mirrorSentenceDraft();
  saveChain = saveChain
    .then(() => saveState(state))
    .then(() => { saveFailureShown = false; })
    .catch((error) => {
      console.error('Listenwrite save failed', error);
      if (!saveFailureShown) { saveFailureShown = true; toast('保存失败，请先导出备份后再继续'); }
    });
  return saveChain;
}''', True))
app_edits.append(('speech override', r"function speak\(text\) \{.*?\n\}", '''function speak(text, rateOverride=null) {
  if (!window.speechSynthesis) return toast('当前浏览器不支持朗读');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = rateOverride==null ? (Number(state.settings.speechRate)||0.92) : Math.min(1.5,Math.max(0.5,Number(rateOverride)||0.75));
  speechSynthesis.speak(u);
}''', True))
app_edits.append(('status helper', r"function sentenceStateInfo\(entry\)\{[^\n]*\}", "function sentenceStatusLabel(status){return status==='repeat'?'需重练':status==='done'?'已通过':status==='ignored'?'忽略':'未练';}\nfunction sentenceStateInfo(entry){const status=deriveSentencePracticeStatus(entry),wholeStatus=deriveWholeSentenceStatus(entry),splitStatus=deriveSplitSentenceStatus(entry);return{status,label:sentenceStatusLabel(status),whole:{status:wholeStatus,label:sentenceStatusLabel(wholeStatus)},split:{status:splitStatus,label:sentenceStatusLabel(splitStatus)}};}", True))
app_edits.append(('library html', r"function sentenceLibraryBookHtml\(book\)\{.*?\n\}", '''function sentenceLibraryBookHtml(book){
  const rank={repeat:0,unseen:1,done:2,ignored:3};
  const entries=[...(book.entries||[])].sort((a,b)=>(rank[sentenceStateInfo(a).status]-rank[sentenceStateInfo(b).status])||(Number(b.lastPracticedAt||b.updatedAt||0)-Number(a.lastPracticedAt||a.updatedAt||0)));
  const repeat=entries.filter(e=>sentenceStateInfo(e).status==='repeat').length;
  return `<details class="sentence-book"><summary><b>${esc(book.name)}</b><span class="small">${entries.length} 句${repeat?` · ${repeat} 句需重练`:''}</span></summary><div class="row" style="justify-content:flex-end;padding:8px 0"><button class="danger" data-delete-sentence-book="${book.id}">删除句子本</button></div><div>${entries.map(entry=>{const st=sentenceStateInfo(entry);const problems=sentenceProblemTokens(entry).filter(token=>!isSimpleLexeme(state,token.normalized||token.surface));return`<div class="sentence-entry"><div class="sentence-entry-meta"><span class="sentence-state ${st.whole.status}">整句 ${st.whole.label}</span><span class="sentence-state ${st.split.status}">拆词 ${st.split.label}</span><span class="small">${sentenceSourceBadge(entry)}${problems.length?` · 错词 ${problems.length}`:''}</span></div><div class="sentence-entry-text">${esc(entry.text)}</div><div class="sentence-mode-row"><button class="soft" data-whole-entry="${book.id}|${entry.id}">整句听写</button><button class="soft" data-split-entry="${book.id}|${entry.id}">拆词听写</button>${problems.length?`<button class="soft" data-problem-entry="${book.id}|${entry.id}">只练错词</button>`:''}<button class="ghost" data-ignore-entry="${book.id}|${entry.id}">${st.status==='ignored'?'恢复':'忽略'}</button><button class="danger" data-delete-sentence-entry="${book.id}|${entry.id}">删除</button></div></div>`;}).join('')||'<div class="empty">还没有句子。</div>'}</div></details>`;
}''', True))
app_edits.append(('library actions', r"function bindSentenceLibraryActions\(\)\{.*?\n\}", '''function bindSentenceLibraryActions(){
  document.querySelectorAll('[data-whole-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.wholeEntry.split('|');startWholeSentenceEntry(bookId,entryId);});
  document.querySelectorAll('[data-split-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.splitEntry.split('|');startSavedEntryDictation(bookId,entryId,{onlyProblems:false,unique:false});});
  document.querySelectorAll('[data-problem-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.problemEntry.split('|');startSavedEntryDictation(bookId,entryId,{onlyProblems:true,unique:true});});
  document.querySelectorAll('[data-ignore-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.ignoreEntry.split('|');const {entry}=getSentenceEntry(state,bookId,entryId);if(!entry)return;setSentencePracticeStatus(entry,deriveSentencePracticeStatus(entry)==='ignored'?'unseen':'ignored');persist();renderText();});
  document.querySelectorAll('[data-delete-sentence-entry]').forEach(button=>button.onclick=()=>{const [bookId,entryId]=button.dataset.deleteSentenceEntry.split('|');const {entry}=getSentenceEntry(state,bookId,entryId);if(!entry||!confirm('删除这条句子记录？句子练习历史会一起删除；已导入普通词库的单词不会删除。'))return;deleteSentenceEntry(state,bookId,entryId);persist();renderText();});
  document.querySelectorAll('[data-delete-sentence-book]').forEach(button=>button.onclick=()=>{const book=state.sentenceBooks.find(item=>item.id===button.dataset.deleteSentenceBook);if(!book||!confirm(`删除句子本「${book.name}」及其中 ${(book.entries||[]).length} 条句子记录？已导入普通词库的单词不会删除。`))return;deleteSentenceBook(state,book.id);persist();renderText();});
}''', True))
app_edits.append(('quick split button', "document.getElementById('startQuickWhole').onclick=()=>startQuickWhole(sentenceBox.value,document.getElementById('sentenceBookName').value);document.getElementById('startSentenceDictation').onclick=()=>startSentenceDictation(sentenceBox.value,unique.checked,document.getElementById('sentenceBookName').value);document.getElementById('saveQuickOnly').onclick=()=>saveQuickOnly(sentenceBox.value,document.getElementById('sentenceBookName').value);", "document.getElementById('startQuickWhole').onclick=()=>startQuickWhole(sentenceBox.value,document.getElementById('sentenceBookName').value);document.getElementById('startSentenceDictation').onclick=()=>startQuickSplit(sentenceBox.value,unique.checked,document.getElementById('sentenceBookName').value);document.getElementById('saveQuickOnly').onclick=()=>saveQuickOnly(sentenceBox.value,document.getElementById('sentenceBookName').value);", False))
app_edits.append(('quick split helper', "function startQuickWhole(raw,bookName){const entries=saveQuickEntries(raw,bookName);if(!entries.length)return toast('没有识别到可听写的句子');startWholeSequence(entries,null);}\nfunction saveQuickOnly", '''function startQuickWhole(raw,bookName){const entries=saveQuickEntries(raw,bookName);if(!entries.length)return toast('没有识别到可听写的句子');startWholeSequence(entries,null);}
function startQuickSplit(raw,unique,bookName){const entries=saveQuickEntries(raw,bookName);if(!entries.length)return toast('没有识别到可听写的句子');const items=[],seen=new Set();let skippedSimple=0;for(const ref of entries){const {entry}=getSentenceEntry(state,ref.bookId,ref.entryId);if(!entry)continue;for(let tokenIndex=0;tokenIndex<(entry.tokens||[]).length;tokenIndex++){const token=entry.tokens[tokenIndex],key=token.normalized||String(token.surface).toLowerCase();if(isSimpleLexeme(state,key)){skippedSimple++;continue;}if(unique&&seen.has(key))continue;seen.add(key);items.push({bookId:ref.bookId,entryId:ref.entryId,tokenIndex});}}if(!items.length)return toast('这些句子没有需要听写的词');startSentenceItems(items,`${bookName||'句子词库'} · ${entries.length} 句`,{skippedSimple});}
function saveQuickOnly''', False))
app_edits.append(('whole start persistence', r"function startWholeSentenceEntry\(bookId,entryId,\{returnTextId=null,preserveQueue=false\}=\{\}\)\{[^\n]*\}", "function startWholeSentenceEntry(bookId,entryId,{returnTextId=null,preserveQueue=false}={}){if(!preserveQueue)wholeQueue=[];const {book,entry}=getSentenceEntry(state,bookId,entryId);if(!book||!entry)return toast('没有找到这句记录');wholeSentenceRun={bookId,entryId,returnTextId,input:'',alignment:null,revealed:false,peek:false};sentenceRun=null;persist();renderWholeSentenceRun();speak(entry.text);}", True))
app_edits.append(('whole return', r"function returnFromWholeSentenceRun\(run\)\{[^\n]*\}", "function returnFromWholeSentenceRun(run){wholeSentenceRun=null;wholeQueue=[];persist();if(run?.returnTextId){textReaderId=run.returnTextId;view='text';renderTextReader();}else{view='text';renderText();}}", True))
app_edits.append(('whole status', "  const st=sentenceStateInfo(entry);const problems=sentenceProblemTokens(entry).filter(token=>!isSimpleLexeme(state,token.normalized||token.surface));", "  const st=sentenceStateInfo(entry),modeStatus=st.whole;const problems=sentenceProblemTokens(entry).filter(token=>!isSimpleLexeme(state,token.normalized||token.surface));", False))
app_edits.append(('whole status badge', '<span class="sentence-state ${st.status}">${st.label}</span><button id="wholeSpeak" class="speaker">◖))</button>', '<span class="sentence-state ${modeStatus.status}">整句 ${modeStatus.label}</span><button id="wholeSpeak" class="speaker">◖))</button><button id="wholeSlow" class="soft" style="margin-top:8px">慢速重听 · 0.75×</button>', False))
app_edits.append(('whole slow bind', "document.getElementById('wholeBack').onclick=()=>returnFromWholeSentenceRun(run);document.getElementById('wholeSpeak').onclick=()=>speak(entry.text);document.getElementById('wholeIgnore').onclick=", "document.getElementById('wholeBack').onclick=()=>returnFromWholeSentenceRun(run);document.getElementById('wholeSpeak').onclick=()=>speak(entry.text);document.getElementById('wholeSlow').onclick=()=>speak(entry.text,(Number(state.settings.speechRate)||.92)*.75);document.getElementById('wholeIgnore').onclick=", False))
app_edits.append(('whole draft input', "if(!run.revealed){const input=document.getElementById('wholeSentenceAnswer');input.focus();document.getElementById('wholeSubmit').onclick=", "if(!run.revealed){const input=document.getElementById('wholeSentenceAnswer');input.focus();input.oninput=()=>{run.input=input.value;scheduleSentenceDraftPersist();};document.getElementById('wholeSubmit').onclick=", False))
app_edits.append(('whole retry persist', "document.getElementById('wholeRetry').onclick=()=>{run.input='';run.alignment=null;run.revealed=false;run.peek=false;renderWholeSentenceRun();speak(entry.text);};", "document.getElementById('wholeRetry').onclick=()=>{run.input='';run.alignment=null;run.revealed=false;run.peek=false;persist();renderWholeSentenceRun();speak(entry.text);};", False))
app_edits.append(('split start persist', r"function startSentenceItems\(items,label,\{returnTextId=null,skippedSimple=0\}=\{\}\)\{[^\n]*\}", "function startSentenceItems(items,label,{returnTextId=null,skippedSimple=0}={}){sentenceRun={items:[...items],cursor:0,label,input:'',result:null,revealed:false,lookups:0,correct:0,returnTextId,skippedSimple,completed:false};wholeSentenceRun=null;wholeQueue=[];persist();renderSentenceRun();const current=sentenceRunCurrent();if(current?.token)speak(current.token.surface);}", True))
app_edits.append(('split return', r"function returnFromSentenceRun\(run\)\{[^\n]*\}", "function returnFromSentenceRun(run){sentenceRun=null;persist();if(run?.returnTextId){textReaderId=run.returnTextId;view='text';renderTextReader();}else{view='text';renderText();}}", True))
app_edits.append(('split advance persist', r"function advanceSentenceRun\(\)\{[^\n]*\}", "function advanceSentenceRun(){sentenceRun.cursor++;sentenceRun.input='';sentenceRun.result=null;sentenceRun.revealed=false;while(sentenceRun.cursor<sentenceRun.items.length){const current=sentenceRunCurrent();if(current?.token&&!isSimpleLexeme(state,current.token.normalized||current.token.surface))break;sentenceRun.cursor++;}persist();if(sentenceRun.cursor>=sentenceRun.items.length)return finishSentenceRun();renderSentenceRun();const current=sentenceRunCurrent();if(current?.token)speak(current.token.surface);}", True))
app_edits.append(('split status var', "  const {book,entry,token,tokenIndex}=current;const status=token.status;", "  const {book,entry,token,tokenIndex}=current;const status=token.status,splitState=sentenceStateInfo(entry).split;", False))
app_edits.append(('split status badge', '<div class="small">${esc(sentenceSourceLabel(entry))}${duplicateNote}${sentenceRun.skippedSimple?` · 已跳过简单词 ${sentenceRun.skippedSimple}`:\'\'}</div><button id="sentenceSpeak" class="speaker">◖))</button>', '<div class="sentence-entry-meta" style="justify-content:center"><span class="sentence-state ${splitState.status}">拆词 ${splitState.label}</span><span class="small">${esc(sentenceSourceLabel(entry))}${duplicateNote}${sentenceRun.skippedSimple?` · 已跳过简单词 ${sentenceRun.skippedSimple}`:\'\'}</span></div><button id="sentenceSpeak" class="speaker">◖))</button>', False))
app_edits.append(('split draft input', "if(!sentenceRun.revealed){const input=document.getElementById('sentenceAnswer');input.value=sentenceRun.input;input.focus();const reveal=", "if(!sentenceRun.revealed){const input=document.getElementById('sentenceAnswer');input.value=sentenceRun.input;input.focus();input.oninput=()=>{sentenceRun.input=input.value;scheduleSentenceDraftPersist();};const reveal=", False))
app_edits.append(('import returns ids', r"function importSentenceProblems\(tokens,targetName,sentence\)\{[^\n]*\}", "function importSentenceProblems(tokens,targetName,sentence){const target=String(targetName||'句子错题本').trim()||'句子错题本';registerErrorBook(target);let missing=0;const ids=[];for(const token of tokens){const en=String(token.normalized||token.surface||'').toLowerCase();const existing=state.words.find(w=>w.en===en);const w=upsertWord({en,zh:existing?.zh||'',source:target,example:token.sentence||sentence,reviewHint:true});if(w){if(!ids.includes(w.id))ids.push(w.id);if(!w.zh){w.needsMeaning=true;missing++;}}}persist();toast(`已加入「${target}」${missing?` · ${missing} 个待批量补释义`:''}`);return ids;}", True))
app_edits.append(('free batch helper', "function freeListenCurrent(){return wordById(freeListen?.ids?.[freeListen.index]);}", "function startFreeListenBatch(ids,label='本轮句子错词'){ids=[...new Set(ids||[])].filter(id=>wordById(id)&&!wordById(id).retired);if(!ids.length)return toast('这批没有可自由听的词');freeListen={book:label,ids,index:0,scope:'batch',limit:ids.length,revealed:false,result:null,bad:[],batch:true};renderFreeListen();speak(wordById(ids[0]).en);}\nfunction freeListenCurrent(){return wordById(freeListen?.ids?.[freeListen.index]);}", False))
app_edits.append(('skip batch save progress', "function saveFreeProgress(){if(!freeListen)return;", "function saveFreeProgress(){if(!freeListen||freeListen.batch)return;", False))
app_edits.append(('skip batch completion progress', "function finishFreeListen(){if(!freeListen)return;const run=freeListen;const bad=[...run.bad];freeProgressMap()[run.book]={scope:run.scope,limit:run.limit,index:0,updatedAt:Date.now(),completedAt:Date.now()};persist();", "function finishFreeListen(){if(!freeListen)return;const run=freeListen;const bad=[...run.bad];if(!run.batch)freeProgressMap()[run.book]={scope:run.scope,limit:run.limit,index:0,updatedAt:Date.now(),completedAt:Date.now()};persist();", False))
app_edits.append(('finish split status', "const remain=sentenceProblemTokens(entry).filter(token=>!isSimpleLexeme(state,token.normalized||token.surface));setSentencePracticeStatus(entry,remain.length?'repeat':'done');", "const remain=sentenceProblemTokens(entry).filter(token=>!isSimpleLexeme(state,token.normalized||token.surface));setSplitSentencePracticeStatus(entry,remain.length?'repeat':'done');", False))
app_edits.append(('finish sentence mark completed', "function finishSentenceRun(){const run=sentenceRun;if(!run)return;", "function finishSentenceRun(){const run=sentenceRun;if(!run)return;run.completed=true;", False))
app_edits.append(('free listen button', '<button id="importSentenceBad" class="primary" ${problems.length?\'\':\'disabled\'}>加入错题本 · ${problems.length}</button><button id="exportSentenceBad"', '<button id="importSentenceBad" class="primary" ${problems.length?\'\':\'disabled\'}>加入错题本 · ${problems.length}</button><button id="listenSentenceBad" class="soft" ${problems.length?\'\':\'disabled\'}>加入并自由听 · ${problems.length}</button><button id="exportSentenceBad"', False))
app_edits.append(('free listen handler', "document.getElementById('importSentenceBad').onclick=()=>importSentenceProblems(problems,document.getElementById('sentenceErrorBook').value,'');document.getElementById('exportSentenceBad').onclick=", "document.getElementById('importSentenceBad').onclick=()=>importSentenceProblems(problems,document.getElementById('sentenceErrorBook').value,'');document.getElementById('listenSentenceBad').onclick=()=>{const name=document.getElementById('sentenceErrorBook').value.trim()||'句子错题本';const ids=importSentenceProblems(problems,name,'');startFreeListenBatch(ids,`${name} · 本轮句子错词`);};document.getElementById('exportSentenceBad').onclick=", False))
app_edits.append(('reader fallback state', "const sentenceState=linkedEntries.length?sentenceStateInfo(linkedEntries[0].entry):{status:'unseen',label:'未练'};", "const sentenceState=linkedEntries.length?sentenceStateInfo(linkedEntries[0].entry):{status:'unseen',label:'未练',whole:{status:'unseen',label:'未练'},split:{status:'unseen',label:'未练'}};", False))
app_edits.append(('reader badges', '<span class="sentence-state ${sentenceState.status}">${sentenceState.label}</span>${linkedProblemCount?', '<span class="sentence-state ${sentenceState.whole.status}">整句 ${sentenceState.whole.label}</span><span class="sentence-state ${sentenceState.split.status}">拆词 ${sentenceState.split.label}</span>${linkedProblemCount?', False))
app_edits.append(('init restore', "(async function init(){state=await loadState();statDay=currentDayKey();statMonth=calendarDate(statDay);render();})();", "document.addEventListener('visibilitychange',()=>{if(document.hidden&&(wholeSentenceRun||sentenceRun)){const wholeInput=document.getElementById('wholeSentenceAnswer');if(wholeSentenceRun&&wholeInput)wholeSentenceRun.input=wholeInput.value;const splitInput=document.getElementById('sentenceAnswer');if(sentenceRun&&splitInput)sentenceRun.input=splitInput.value;persist();}});\n\n(async function init(){state=await loadState();statDay=currentDayKey();statMonth=calendarDate(statDay);const restored=restoreSentenceSession();if(restored==='whole')renderWholeSentenceRun();else if(restored==='split'){if(sentenceRun.completed)finishSentenceRun();else renderSentenceRun();}else render();})();", False))
patch('src/app.js', app_edits)

Path('tests/v22.test.js').write_text('''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spellingMatches } from '../src/tokenizer.js';
import { alignSentenceInput } from '../src/textsentences.js';
import { addSentenceEntry, deleteSentenceEntry, deleteSentenceBook, deriveSentencePracticeStatus, deriveWholeSentenceStatus, deriveSplitSentenceStatus, recordWholeSentenceAttempt, setSplitSentencePracticeStatus } from '../src/sentencebooks.js';
import { defaultState, normalizeState } from '../src/storage.js';

test('numeric equivalence is symmetric',()=>{assert.equal(spellingMatches('twenty five','25'),true);assert.equal(spellingMatches('25','twenty five'),true);assert.equal(spellingMatches('eight thirty','8:30'),true);assert.equal(spellingMatches('sixth','6th'),true);assert.equal(spellingMatches('twenty six','25'),false);});
test('whole sentence alignment accepts spoken numeric spans',()=>{assert.equal(alignSentenceInput('The fee is £25 on the 6th.','The fee is twenty five pounds on the sixth').correct,true);assert.equal(alignSentenceInput('Meet me at 8:30.','Meet me at eight thirty').correct,true);});
test('whole and split states stay independent',()=>{const s={sentenceBooks:[],words:[],simpleWords:[]};const {entry}=addSentenceEntry(s,{bookName:'A',text:'Rural areas are quiet.',tokens:['Rural','areas','are','quiet']});recordWholeSentenceAttempt(entry,{input:'Rural areas quiet',alignment:{correct:false,distance:1,operations:[]}});setSplitSentencePracticeStatus(entry,'done');assert.equal(deriveWholeSentenceStatus(entry),'repeat');assert.equal(deriveSplitSentenceStatus(entry),'done');assert.equal(deriveSentencePracticeStatus(entry),'repeat');recordWholeSentenceAttempt(entry,{input:'Rural areas are quiet',alignment:{correct:true,distance:0,operations:[]}});assert.equal(deriveSentencePracticeStatus(entry),'done');});
test('sentence deletion does not delete vocabulary',()=>{const s={sentenceBooks:[],words:[{id:'w1',en:'rural'}],simpleWords:[]};const a=addSentenceEntry(s,{bookName:'A',text:'One.',tokens:['One']});addSentenceEntry(s,{bookName:'A',text:'Two.',tokens:['Two']});assert.equal(deleteSentenceEntry(s,a.book.id,a.entry.id).removedEntries,1);assert.equal(deleteSentenceBook(s,a.book.id).removedEntries,1);assert.equal(s.words.length,1);});
test('sentence session survives normalization',()=>{const s=defaultState();s.sentenceSession={mode:'whole',updatedAt:123,run:{bookId:'b1',entryId:'e1',input:'half written',revealed:false,peek:false},queue:[{bookId:'b1',entryId:'e2'}]};const n=normalizeState(s);assert.equal(n.sentenceSession.run.input,'half written');assert.equal(n.sentenceSession.queue.length,1);});
test('sentence UI wires recovery and daily-use controls',()=>{const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');for(const needle of ['SENTENCE_DRAFT_KEY','scheduleSentenceDraftPersist','wholeSlow','data-delete-sentence-entry','data-delete-sentence-book','startQuickSplit','startFreeListenBatch','setSplitSentencePracticeStatus'])assert.ok(app.includes(needle),needle);});
''')
print('v22 sentence patch applied')
