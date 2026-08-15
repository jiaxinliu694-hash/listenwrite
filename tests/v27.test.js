import test from 'node:test';
import assert from 'node:assert/strict';
import { markSimpleLexeme } from '../src/sentencebooks.js';
import { linkedTextEntries, textPracticeWords, textUnfamiliarTokens, textCollectionUnfamiliarTokens, textCollectionSummaries } from '../src/textlibrary.js';

test('text library groups texts and keeps practiced sentence/word history inside the source text',()=>{
  const state={texts:[{id:'t1',title:'A',collection:'剑18',sentences:[{id:'s1'}],updatedAt:1}],words:[],simpleWords:[],sentenceBooks:[{id:'b1',name:'句子',entries:[{id:'e1',sourceTextId:'t1',sentenceIndex:0,text:'Rural areas.',lastPracticedAt:20,tokens:[{surface:'Rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:20}]},{surface:'areas',normalized:'areas',status:'familiar',attempts:[{ts:20}]}]}]}]};
  assert.equal(linkedTextEntries(state,'t1',{practicedOnly:true}).length,1);
  const words=textPracticeWords(state,'t1');assert.equal(words.length,2);assert.equal(words.find(w=>w.lexeme==='rural').status,'unfamiliar');
  const groups=textCollectionSummaries(state);assert.equal(groups[0].name,'剑18');assert.equal(groups[0].practicedSentenceCount,1);assert.equal(groups[0].wordCount,2);
});

test('mistaken simple mark is reversible and text history reflects the restored state',()=>{
  const state={texts:[{id:'t1',title:'A',collection:'剑18'}],words:[{id:'w1',en:'rural',retired:false}],simpleWords:[],sentenceBooks:[{id:'b1',entries:[{id:'e1',sourceTextId:'t1',text:'Rural.',tokens:[{surface:'Rural',normalized:'rural',status:'familiar',attempts:[{ts:10}]}]}]}]};
  markSimpleLexeme(state,'rural',true);assert.equal(textPracticeWords(state,'t1')[0].simple,true);assert.equal(state.words[0].retired,true);
  markSimpleLexeme(state,'rural',false);assert.equal(textPracticeWords(state,'t1')[0].simple,false);assert.equal(state.words[0].retired,false);
});


test('text-specific unfamiliar export de-duplicates weak words and excludes simple words',()=>{
  const state={texts:[{id:'t1',title:'A',collection:'剑18'}],words:[],simpleWords:['areas'],sentenceBooks:[{id:'b1',entries:[{id:'e1',sourceTextId:'t1',text:'Rural areas rural.',tokens:[{surface:'Rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:10}]},{surface:'areas',normalized:'areas',status:'unfamiliar',attempts:[{ts:11}]},{surface:'rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:12}]}]}]}]};
  const tokens=textUnfamiliarTokens(state,'t1');
  assert.equal(tokens.length,1);
  assert.equal(tokens[0].normalized,'rural');
  assert.equal(tokens[0].occurrences.length,2);
});


test('collection-level unfamiliar export merges all texts in the book and de-duplicates words',()=>{
  const state={texts:[{id:'t1',collection:'剑18'},{id:'t2',collection:'剑18'},{id:'t3',collection:'剑19'}],words:[],simpleWords:[],sentenceBooks:[{id:'b',entries:[
    {id:'e1',sourceTextId:'t1',text:'Rural areas.',tokens:[{surface:'Rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:1}]}]},
    {id:'e2',sourceTextId:'t2',text:'Rural residents commute.',tokens:[{surface:'Rural',normalized:'rural',status:'unfamiliar',attempts:[{ts:2}]},{surface:'commute',normalized:'commute',status:'unfamiliar',attempts:[{ts:2}]}]},
    {id:'e3',sourceTextId:'t3',text:'Remote work.',tokens:[{surface:'Remote',normalized:'remote',status:'unfamiliar',attempts:[{ts:3}]}]}
  ]}]};
  const tokens=textCollectionUnfamiliarTokens(state,'剑18');
  assert.deepEqual(tokens.map(x=>x.normalized),['commute','rural']);
  assert.equal(tokens.find(x=>x.normalized==='rural').sourceTextIds.length,2);
});
