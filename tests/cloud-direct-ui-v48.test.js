import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
test('v48 personal entry auto-connects and syncs existing history without auth forms or email',async t=>{
  const errors=[], observers=[], calls=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const secret='c'.repeat(64),uid='00000000-0000-4000-8000-000000000048';
  const dom=new JSDOM('<!doctype html><div class="topbar"><div class="toolbar"></div></div>',{url:`https://jiaxinliu694-hash.github.io/listenwrite/#lw_sync=${secret}`,pretendToBeVisual:true,virtualConsole:vc});
  const names=['window','document','location','history','localStorage','MutationObserver','indexedDB','fetch','setInterval'];
  const originals=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
  for(const name of names.slice(0,7))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name]});
  globalThis.MutationObserver=class extends dom.window.MutationObserver{constructor(cb){super(cb);observers.push(this);}};
  globalThis.indexedDB=new IDBFactory();globalThis.setInterval=()=>({unref(){}});
  t.after(async()=>{for(const o of observers)o.disconnect();dom.window.close();await new Promise(r=>queueMicrotask(r));for(const[n,d]of originals){if(d)Object.defineProperty(globalThis,n,d);else delete globalThis[n];}assert.deepEqual(errors,[]);});
  const storage=await import('../src/storage.js');
  const state=storage.defaultState();state.words=[{id:'existing-word',en:'leader',zh:'领导者',sources:['personal'],examples:[]}];
  state.events=[{id:'existing-event',wordId:'existing-word',mode:'listen',result:'bad',ts:1788663600000,date:'2026-09-06'}];
  const canonical=storage.canonicalizeCloudState(state);await storage.saveState(canonical);
  globalThis.fetch=async(url,opts)=>{calls.push({url,opts});const data=url.endsWith('listenwrite_direct_connect')?{connected:true,user_id:uid}:[{state:canonical,revision:10,state_updated_at:1,synced_at:'2026-09-06'}];return{ok:true,status:200,json:async()=>data};};
  const cloud=await import('../src/cloudsync.js?direct-v48');await cloud.initCloudSync();
  for(let i=0;i<100;i++){if(document.getElementById('cloudSyncTop')?.textContent==='云已同步')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(document.getElementById('cloudSyncTop').textContent,'云已同步');document.getElementById('cloudSyncTop').click();
  assert.equal(document.getElementById('lwCloudPassword'),null);assert.equal(document.getElementById('lwCloudMagicLogin'),null);assert.equal(document.getElementById('lwCloudNewPassword'),null);
  assert.ok(document.getElementById('lwDirectCopy'));assert.equal(location.hash,'');
  assert.equal(calls.some(c=>c.url.includes('/auth/')),false);assert.equal(calls.some(c=>c.url.endsWith('listenwrite_direct_push')),false);
  assert.ok(calls.some(c=>c.url.endsWith('listenwrite_direct_pull')));
  assert.deepEqual((await storage.readPersistedState()).events,canonical.events);
  assert.equal(JSON.stringify(await storage.readPersistedState()).includes(secret),false);
});
