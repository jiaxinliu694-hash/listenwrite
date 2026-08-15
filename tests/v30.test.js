import test from 'node:test';
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
