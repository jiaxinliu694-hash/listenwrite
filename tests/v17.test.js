import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteWordbook } from '../src/wordadmin.js';

function baseState(){return {words:[
  {id:'a',en:'alpha',sources:['A']},
  {id:'s',en:'shared',sources:['A','B']},
  {id:'b',en:'bravo',sources:['B']},
],events:[
  {id:'ea',wordId:'a',mode:'listen'},
  {id:'es',wordId:'s',mode:'listen'},
],simpleWords:[],errorBooks:['A'],dailyPlans:{d:{mode:'mixed',books:['A','B'],newIds:['a','s','b'],reviewIds:[],bookSegments:[],resumeWordId:'a'}},settings:{todayBooks:['A'],typeBooks:['A','B'],freeListenProgress:{A:{index:4}}}};}

test('removing a wordbook keeps words and learning history',()=>{
  const s=baseState();
  const r=deleteWordbook(s,'A',{purgeExclusive:false});
  assert.equal(r.affected,2);
  assert.equal(r.removedWords,0);
  assert.ok(s.words.find(w=>w.id==='a'));
  assert.deepEqual(s.words.find(w=>w.id==='a').sources,[]);
  assert.deepEqual(s.words.find(w=>w.id==='s').sources,['B']);
  assert.equal(s.events.length,2);
  assert.deepEqual(s.settings.todayBooks,[]);
  assert.deepEqual(s.settings.typeBooks,['B']);
  assert.equal(s.settings.freeListenProgress.A,undefined);
});

test('purging a wordbook deletes only exclusive words and their records',()=>{
  const s=baseState();
  const r=deleteWordbook(s,'A',{purgeExclusive:true});
  assert.equal(r.removedWords,1);
  assert.equal(r.sharedWords,1);
  assert.equal(s.words.some(w=>w.id==='a'),false);
  assert.equal(s.events.some(e=>e.wordId==='a'),false);
  assert.deepEqual(s.words.find(w=>w.id==='s').sources,['B']);
  assert.equal(s.events.some(e=>e.wordId==='s'),true);
  assert.equal(s.dailyPlans.d.newIds.includes('a'),false);
  assert.equal(s.dailyPlans.d.resumeWordId,null);
});

test('purging sequential wordbook removes its segment but preserves other segments',()=>{
  const s=baseState();
  s.dailyPlans.d={mode:'sequential',books:['A','B'],newIds:['a','s','b'],reviewIds:[],resumeWordId:null,bookSegments:[
    {book:'A',newIds:['a','s'],reviewIds:[]},
    {book:'B',newIds:['b'],reviewIds:[]},
  ]};
  deleteWordbook(s,'A',{purgeExclusive:true});
  assert.deepEqual(s.dailyPlans.d.books,['B']);
  assert.deepEqual(s.dailyPlans.d.bookSegments.map(x=>x.book),['B']);
  assert.deepEqual(s.dailyPlans.d.newIds,['b']);
});
