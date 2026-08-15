from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'marker missing in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1))

# Add CSV serializer while keeping TSV import/export compatibility elsewhere.
path='src/sentencebooks.js'
insert="""export function problemTokensToTSV(tokens, { source = '句子错题本', sentence = '' } = {}) {
  const rows = ['en\tzh\tpos\tdef\tsource\texample'];
  const seen = new Set();
  for (const token of tokens) {
    const en = token.normalized || normalizeLexeme(token.surface);
    if (!en || seen.has(en)) continue;
    seen.add(en);
    rows.push([
      en,
      '', '', '',
      source,
      token.sentence || sentence || '',
    ].map(tsvCell).join('\t'));
  }
  return rows.join('\n');
}
"""
addition=insert+"""
function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return /[\",\r\n]/.test(text) ? `\"${text.replace(/\"/g, '\"\"')}\"` : text;
}

export function problemTokensToCSV(tokens, { source = '句子错题本', sentence = '' } = {}) {
  const rows = [['en','zh','pos','def','source','example']];
  const seen = new Set();
  for (const token of tokens) {
    const en = token.normalized || normalizeLexeme(token.surface);
    if (!en || seen.has(en)) continue;
    seen.add(en);
    rows.push([en, '', '', '', source, token.sentence || sentence || '']);
  }
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
"""
replace_once(path,insert,addition)

path='src/app.js'
replace_once(path,
"sentenceSourceLabel, problemTokensToTSV, deriveSentencePracticeStatus",
"sentenceSourceLabel, problemTokensToTSV, problemTokensToCSV, deriveSentencePracticeStatus")

repls={
"download(`${safe}-整库不熟悉-${currentDayKey()}.tsv`,problemTokensToTSV(collectionUnfamiliar,{source:`${name} · 整库不熟悉`}),'text/tab-separated-values;charset=utf-8')":"download(`${safe}-整库不熟悉-${currentDayKey()}.csv`,problemTokensToCSV(collectionUnfamiliar,{source:`${name} · 整库不熟悉`}),'text/csv;charset=utf-8')",
"download(`${safe}-当前不熟悉-${currentDayKey()}.tsv`,problemTokensToTSV(unfamiliar,{source}),'text/tab-separated-values;charset=utf-8')":"download(`${safe}-当前不熟悉-${currentDayKey()}.csv`,problemTokensToCSV(unfamiliar,{source}),'text/csv;charset=utf-8')",
"download(`${safe}-旧版不熟候选-${currentDayKey()}.tsv`,problemTokensToTSV(legacyCandidates,{source}),'text/tab-separated-values;charset=utf-8')":"download(`${safe}-旧版不熟候选-${currentDayKey()}.csv`,problemTokensToCSV(legacyCandidates,{source}),'text/csv;charset=utf-8')",
}
for old,new in repls.items():
    replace_once(path,old,new)

replace_once('index.html','app.bundle.js?v=30-manual-sentence-status','app.bundle.js?v=31-openable-csv')

Path('tests/v31.test.js').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { problemTokensToCSV } from '../src/sentencebooks.js';

test('sentence unfamiliar export is Excel/Numbers-friendly UTF-8 CSV with BOM',()=>{
  const csv=problemTokensToCSV([
    {normalized:'collars',sentence:'Collars, which were fitted, helped track them.'},
    {normalized:'matriarch',sentence:'The \"matriarch\" led the group.'},
    {normalized:'collars',sentence:'duplicate'},
  ],{source:'剑18 · Test1Part4 · 当前不熟悉'});
  assert.equal(csv.charCodeAt(0),0xfeff);
  assert.ok(csv.includes('en,zh,pos,def,source,example'));
  assert.ok(csv.includes('collars'));
  assert.ok(csv.includes('"Collars, which were fitted, helped track them."'));
  assert.ok(csv.includes('"The ""matriarch"" led the group."'));
  assert.equal((csv.match(/collars/g)||[]).length,1);
});

test('text unfamiliar download buttons use csv rather than tsv',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes('-整库不熟悉-${currentDayKey()}.csv'));
  assert.ok(app.includes('-当前不熟悉-${currentDayKey()}.csv'));
  assert.ok(app.includes('-旧版不熟候选-${currentDayKey()}.csv'));
  assert.ok(app.includes("'text/csv;charset=utf-8'"));
});
""")
