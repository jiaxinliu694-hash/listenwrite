import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { problemTokensToCSV } from '../src/sentencebooks.js';

test('sentence unfamiliar export is Excel/Numbers-friendly UTF-8 CSV with BOM',()=>{
  const csv=problemTokensToCSV([
    {normalized:'collars',sentence:'Collars, which were fitted, helped track them.'},
    {normalized:'matriarch',sentence:'The "matriarch" led the group.'},
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
