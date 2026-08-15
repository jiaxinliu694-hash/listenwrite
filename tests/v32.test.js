import test from 'node:test';
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
