import test from 'node:test';
import assert from 'node:assert/strict';
import { createRetrySession } from '../src/queue.js';

function stateFor(ids){
  return { words: ids.map(id=>({id,en:id,zh:'',sources:['A'],retired:false,card:null})), events:[], settings:{retention:0.9} };
}

test('formal study mixes new and review cards in one stable daily order',()=>{
  const newIds=Array.from({length:10},(_,i)=>`n${i+1}`);
  const reviewIds=Array.from({length:10},(_,i)=>`r${i+1}`);
  const s=stateFor([...newIds,...reviewIds]);
  const plan={date:'2026-08-14',books:['A'],drawNonce:2,newIds,reviewIds,resumeWordId:null};
  const a=createRetrySession(s,plan,'listen');
  const b=createRetrySession(s,plan,'listen');
  assert.deepEqual(a.fixedIds,b.fixedIds);
  assert.deepEqual(new Set(a.fixedIds),new Set([...newIds,...reviewIds]));
  assert.notDeepEqual(a.fixedIds,[...reviewIds,...newIds]);
  const firstSix=a.fixedIds.slice(0,6);
  assert.ok(firstSix.some(id=>id.startsWith('n')));
  assert.ok(firstSix.some(id=>id.startsWith('r')));
});

test('resume hint still wins over mixed base order while due retries keep priority',()=>{
  const ids=['n1','n2','r1','r2'];
  const s=stateFor(ids);
  const plan={date:'2026-08-14',books:['A'],drawNonce:1,newIds:['n1','n2'],reviewIds:['r1','r2'],resumeWordId:'n2'};
  const q=createRetrySession(s,plan,'listen');
  assert.equal(q.pendingBase[0],'n2');
});
