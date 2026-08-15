from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'marker missing in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1))

# 1) Sentence token state: spelling attempts must not overwrite manual familiarity.
path = 'src/sentencebooks.js'
text = Path(path).read_text()
replace_once(path,
"""export function recordSentenceToken(entry, tokenIndex, { input = '', spellingResult = null, status = null } = {}) {
  const token = entry?.tokens?.[tokenIndex];
  if (!token) return null;
  token.lastInput = String(input || '');
  token.lastSpellingResult = spellingResult === 'good' ? 'good' : spellingResult === 'bad' ? 'bad' : null;
  const nextStatus = status === 'unknown' ? 'unfamiliar' : status;
  if (nextStatus && VALID_STATUS.has(nextStatus)) token.status = nextStatus;
  token.attempts = Array.isArray(token.attempts) ? token.attempts : [];
  token.attempts.push({ ts: Date.now(), input: token.lastInput, spellingResult: token.lastSpellingResult, status: token.status });
  entry.updatedAt = Date.now();
  return token;
}

export function setSentenceTokenStatus(entry, tokenIndex, status) {
  const token = entry?.tokens?.[tokenIndex];
  const nextStatus = status === 'unknown' ? 'unfamiliar' : status;
  if (!token || !VALID_STATUS.has(nextStatus)) return null;
  token.status = nextStatus;
  entry.updatedAt = Date.now();
  return token;
}
""",
"""export function recordSentenceToken(entry, tokenIndex, { input = '', spellingResult = null } = {}) {
  const token = entry?.tokens?.[tokenIndex];
  if (!token) return null;
  token.lastInput = String(input || '');
  token.lastSpellingResult = spellingResult === 'good' ? 'good' : spellingResult === 'bad' ? 'bad' : null;
  token.attempts = Array.isArray(token.attempts) ? token.attempts : [];
  token.attempts.push({ ts: Date.now(), input: token.lastInput, spellingResult: token.lastSpellingResult });
  entry.updatedAt = Date.now();
  return token;
}

export function setSentenceTokenStatus(entry, tokenIndex, status) {
  const token = entry?.tokens?.[tokenIndex];
  const nextStatus = status === 'unknown' ? 'unfamiliar' : status;
  if (!token || !VALID_STATUS.has(nextStatus)) return null;
  const ts = Date.now();
  token.status = nextStatus;
  token.statusHistory = Array.isArray(token.statusHistory) ? token.statusHistory : [];
  token.statusHistory.push({ ts, status: nextStatus });
  token.legacyUnfamiliarCandidate = false;
  entry.updatedAt = ts;
  return token;
}
""")

replace_once(path,
"""      attempts: [],
    })),
""",
"""      attempts: [],
      statusHistory: [],
      legacyUnfamiliarCandidate: false,
    })),
""")

old = """        attempts: Array.isArray(token.attempts) ? token.attempts : [],
      })),
"""
new = """        attempts: Array.isArray(token.attempts) ? token.attempts : [],
        statusHistory: Array.isArray(token.statusHistory)
          ? token.statusHistory.filter((row) => VALID_STATUS.has(row?.status === 'unknown' ? 'unfamiliar' : row?.status)).map((row) => ({ ts: Number(row.ts) || 0, status: row.status === 'unknown' ? 'unfamiliar' : row.status }))
          : (VALID_STATUS.has(token.status) ? [{ ts: Number((Array.isArray(token.attempts) ? token.attempts : []).at(-1)?.ts) || 0, status: token.status }] : []),
        legacyUnfamiliarCandidate: Boolean(token.legacyUnfamiliarCandidate) || (!Array.isArray(token.statusHistory) && (Array.isArray(token.attempts) ? token.attempts : []).some((attempt) => attempt?.spellingResult === 'bad' || attempt?.status === 'unfamiliar' || attempt?.status === 'unknown')),
      })),
"""
replace_once(path, old, new)

# 2) Text history/export helpers: current manual unfamiliar + recoverable legacy candidates.
path = 'src/textlibrary.js'
text = Path(path).read_text()
insert_after = """export function textUnfamiliarTokens(state, textId) {
  return textPracticeWords(state, textId)
    .filter((word) => word.unfamiliar && !word.simple)
    .map((word) => ({
      surface: word.surface,
      normalized: word.lexeme,
      sentence: word.occurrences.find((occurrence) => occurrence.sentence)?.sentence || '',
      sourceTextId: textId,
      occurrences: word.occurrences.map((occurrence) => ({ ...occurrence })),
    }));
}
"""
addition = insert_after + """
export function textLegacyUnfamiliarCandidates(state, textId) {
  const byLexeme = new Map();
  for (const { book, entry } of linkedTextEntries(state, textId)) {
    for (let tokenIndex = 0; tokenIndex < (entry.tokens || []).length; tokenIndex += 1) {
      const token = entry.tokens[tokenIndex];
      const lexeme = normalizeLexeme(token?.normalized || token?.surface);
      if (!lexeme || isSimpleLexeme(state, lexeme) || !token?.legacyUnfamiliarCandidate) continue;
      const current = byLexeme.get(lexeme) || { surface: String(token.surface || lexeme), normalized: lexeme, sentence: entry.text || '', sourceTextId: textId, occurrences: [] };
      current.occurrences.push({ bookId: book.id, entryId: entry.id, tokenIndex, sentenceIndex: entry.sentenceIndex, sentence: entry.text });
      byLexeme.set(lexeme, current);
    }
  }
  return [...byLexeme.values()].sort((a, b) => a.normalized.localeCompare(b.normalized));
}
"""
replace_once(path, insert_after, addition)

# 3) UI: reveal no longer assigns familiarity automatically; current and legacy exports are explicit.
path = 'src/app.js'
replace_once(path,
"import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textCollectionUnfamiliarTokens, textCollectionSummaries } from './textlibrary.js';",
"import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textLegacyUnfamiliarCandidates, textCollectionUnfamiliarTokens, textCollectionSummaries } from './textlibrary.js';")

replace_once(path,
"""const defaultStatus=sentenceRun.result==='good'?'familiar':'unfamiliar';recordSentenceToken(entry,tokenIndex,{input:sentenceRun.input,spellingResult:sentenceRun.result,status:defaultStatus});sentenceRun.revealed=true;persist();renderSentenceRun();""",
"""recordSentenceToken(entry,tokenIndex,{input:sentenceRun.input,spellingResult:sentenceRun.result});sentenceRun.revealed=true;persist();renderSentenceRun();""")

replace_once(path,
"""document.getElementById('sentenceNext').onclick=advanceSentenceRun;""",
"""document.getElementById('sentenceNext').onclick=()=>{if(!token.status)return toast('先标记「熟悉」或「不熟悉」');advanceSentenceRun();};""")

replace_once(path,
"""  const sentences=linkedTextEntries(state,t.id,{practicedOnly:true});const words=textPracticeWords(state,t.id);const unfamiliar=textUnfamiliarTokens(state,t.id);
""",
"""  const sentences=linkedTextEntries(state,t.id,{practicedOnly:true});const words=textPracticeWords(state,t.id);const unfamiliar=textUnfamiliarTokens(state,t.id);const legacyCandidates=textLegacyUnfamiliarCandidates(state,t.id);
""")

replace_once(path,
">导出本篇不熟悉 · ${unfamiliar.length}</button>",
">导出当前不熟悉 · ${unfamiliar.length}</button>${legacyCandidates.length?`<button id=\"exportLegacyUnfamiliar\" class=\"soft\">旧版不熟候选 · ${legacyCandidates.length}</button>`:''}")

replace_once(path,
"""  document.getElementById('exportTextUnfamiliar').onclick=()=>{if(!unfamiliar.length)return;const source=`${t.collection||'未分类'} · ${t.title} · 不熟悉`;const safe=String(t.title||'文本').replace(/[\\/:*?\"<>|]+/g,'-');download(`${safe}-不熟悉-${currentDayKey()}.tsv`,problemTokensToTSV(unfamiliar,{source}),'text/tab-separated-values;charset=utf-8');toast(`已导出 ${unfamiliar.length} 个不熟悉词`);};
""",
"""  document.getElementById('exportTextUnfamiliar').onclick=()=>{if(!unfamiliar.length)return;const source=`${t.collection||'未分类'} · ${t.title} · 当前不熟悉`;const safe=String(t.title||'文本').replace(/[\\/:*?\"<>|]+/g,'-');download(`${safe}-当前不熟悉-${currentDayKey()}.tsv`,problemTokensToTSV(unfamiliar,{source}),'text/tab-separated-values;charset=utf-8');toast(`已导出 ${unfamiliar.length} 个当前不熟悉词`);};
  if(document.getElementById('exportLegacyUnfamiliar'))document.getElementById('exportLegacyUnfamiliar').onclick=()=>{const source=`${t.collection||'未分类'} · ${t.title} · 旧版不熟候选`;const safe=String(t.title||'文本').replace(/[\\/:*?\"<>|]+/g,'-');download(`${safe}-旧版不熟候选-${currentDayKey()}.tsv`,problemTokensToTSV(legacyCandidates,{source}),'text/tab-separated-values;charset=utf-8');toast(`已导出 ${legacyCandidates.length} 个旧版不熟候选`);};
""")

# 4) Browser cache version.
replace_once('index.html', 'app.bundle.js?v=29-collection-unfamiliar', 'app.bundle.js?v=30-manual-sentence-status')
for test_path in ['tests/v23_1.test.js','tests/v24.test.js']:
    p=Path(test_path)
    s=p.read_text().replace('app.bundle.js?v=29','app.bundle.js?v=30')
    p.write_text(s)

# Update the v26 expectation: spelling and manual familiarity are independent now.
p=Path('tests/v26.test.js')
s=p.read_text()
s=s.replace("recordSentenceToken(entry, 0, { input: '', spellingResult: 'bad', status: 'unknown' });\n  assert.equal(entry.tokens[0].status, 'unfamiliar');", "recordSentenceToken(entry, 0, { input: '', spellingResult: 'bad' });\n  assert.equal(entry.tokens[0].status, null);")
p.write_text(s)

Path('tests/v30.test.js').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSentenceBooks, recordSentenceToken, setSentenceTokenStatus } from '../src/sentencebooks.js';
import { textUnfamiliarTokens, textLegacyUnfamiliarCandidates } from '../src/textlibrary.js';

test('spelling attempts never overwrite manual familiarity',()=>{
  const entry={updatedAt:0,tokens:[{surface:'matriarch',normalized:'matriarch',status:null,attempts:[],statusHistory:[],legacyUnfamiliarCandidate:false}]};
  recordSentenceToken(entry,0,{input:'matriach',spellingResult:'bad'});
  assert.equal(entry.tokens[0].status,null);
  setSentenceTokenStatus(entry,0,'unfamiliar');
  assert.equal(entry.tokens[0].status,'unfamiliar');
  assert.equal(entry.tokens[0].statusHistory.at(-1).status,'unfamiliar');
  recordSentenceToken(entry,0,{input:'matriarch',spellingResult:'good'});
  assert.equal(entry.tokens[0].status,'unfamiliar');
});

test('legacy records preserve recoverable weak candidates when old spelling/status history was conflated',()=>{
  const books=normalizeSentenceBooks([{id:'b',entries:[{id:'e',sourceTextId:'t1',text:'Collars were fitted.',tokens:[{surface:'Collars',normalized:'collars',status:'familiar',attempts:[{ts:1,input:'',spellingResult:'bad',status:'unfamiliar'},{ts:2,input:'collars',spellingResult:'good',status:'familiar'}]}]}]}]);
  const state={texts:[{id:'t1'}],words:[],simpleWords:[],sentenceBooks:books};
  assert.equal(textUnfamiliarTokens(state,'t1').length,0);
  assert.deepEqual(textLegacyUnfamiliarCandidates(state,'t1').map(x=>x.normalized),['collars']);
});

test('a new manual reclassification clears the legacy-candidate flag',()=>{
  const books=normalizeSentenceBooks([{id:'b',entries:[{id:'e',sourceTextId:'t1',text:'Tracked.',tokens:[{surface:'Tracked',normalized:'tracked',status:'familiar',attempts:[{ts:1,spellingResult:'bad',status:'unfamiliar'}]}]}]}]);
  const state={texts:[{id:'t1'}],words:[],simpleWords:[],sentenceBooks:books};
  const token=state.sentenceBooks[0].entries[0].tokens[0];
  assert.equal(token.legacyUnfamiliarCandidate,true);
  setSentenceTokenStatus(state.sentenceBooks[0].entries[0],0,'familiar');
  assert.equal(token.legacyUnfamiliarCandidate,false);
  assert.equal(textLegacyUnfamiliarCandidates(state,'t1').length,0);
});
""")
