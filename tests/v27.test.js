import test from 'node:test';
import assert from 'node:assert/strict';
import { markSimpleLexeme } from '../src/sentencebooks.js';
import { linkedTextEntries, textPracticeWords, textCollectionSummaries } from '../src/textlibrary.js';

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
