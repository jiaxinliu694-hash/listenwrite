import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { storageContext, hasUserData } from '../src/storage.js';

test('storage context distinguishes browser from home-screen app containers',()=>{
  assert.deepEqual(storageContext({standalone:false}),{mode:'browser',label:'浏览器本地数据'});
  assert.deepEqual(storageContext({standalone:true}),{mode:'standalone',label:'主屏幕 App 本地数据'});
});

test('restore overwrite guard ignores bundled sample words but detects real study data',()=>{
  assert.equal(hasUserData({words:[{id:'sample_1'}],texts:[],events:[],activities:[],simpleWords:[],errorBooks:[],dailyPlans:{},sentenceBooks:[],dataChart:{items:[]}}),false);
  assert.equal(hasUserData({words:[{id:'real_1'}]}),true);
  assert.equal(hasUserData({texts:[{id:'t1'}]}),true);
  assert.equal(hasUserData({sentenceBooks:[{entries:[{id:'e1'}]}]}),true);
});

test('global shell exposes restore and empty text library explains local-container isolation',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.ok(app.includes('id=\"restoreTop\"'));
  assert.ok(app.includes('restoreEmptyText'));
  assert.ok(app.includes('主屏幕的 App 可能各自保存一份本地数据'));
  assert.ok(app.includes("hasUserData(state)&&!confirm"));
});

test('browser bundle is cache busted',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/app\.bundle\.js\?v=[a-z0-9_-]+/i);
});
