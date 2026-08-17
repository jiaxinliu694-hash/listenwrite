import test from 'node:test';
import assert from 'node:assert/strict';
import { recentStudyDates, recentListeningRows, recentListeningStatus } from '../src/recenthistory.js';
test('recent study entry covers three study days',()=>assert.deepEqual(recentStudyDates('2026-08-17',3),['2026-08-17','2026-08-16','2026-08-15']));
test('rows include only formal listening',()=>{const state={words:[{id:'a'},{id:'b'}],events:[{id:'1',wordId:'a',date:'2026-08-17',mode:'listen',result:'good',ts:10},{id:'2',wordId:'b',date:'2026-08-17',mode:'type',result:'bad',ts:50},{id:'3',wordId:'b',date:'2026-08-17',mode:'listen',result:'bad',ts:20}]};assert.deepEqual(recentListeningRows(state,'2026-08-17').map(x=>x.word.id),['b','a']);});
test('status uses the same 3-good reinforcement rule',()=>{const word={id:'a',retired:false},events=[{result:'bad',ts:1},{result:'good',ts:2},{result:'good',ts:3}];assert.equal(recentListeningStatus(word,events).label,'巩固 2/3');events.push({result:'good',ts:4});assert.equal(recentListeningStatus(word,events).label,'已熟悉');});
