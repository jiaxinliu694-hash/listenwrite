import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

test('v49 existing-owner cloud dialog creates device link without password or mail and has clipboard fallback',async t=>{
  const errors=[], observers=[], calls=[], intervals=[];
  const vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push(e));
  const uid='00000000-0000-4000-8000-000000000049';
  const dom=new JSDOM('<!doctype html><div class="topbar"><div class="toolbar"></div></div>',{url:'https://jiaxinliu694-hash.github.io/listenwrite/',pretendToBeVisual:true,virtualConsole:vc});
  const names=['window','document','location','history','localStorage','MutationObserver','indexedDB','fetch','setInterval'];
  const originals=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
  for(const n of names.slice(0,7))Object.defineProperty(globalThis,n,{configurable:true,writable:true,value:dom.window[n]});
  globalThis.MutationObserver=class extends dom.window.MutationObserver{constructor(cb){super(cb);observers.push(this);}};
  globalThis.indexedDB=new IDBFactory();globalThis.setInterval=fn=>{intervals.push(fn);return {unref(){}};};
  t.after(async()=>{for(const o of observers)o.disconnect();dom.window.close();await new Promise(r=>queueMicrotask(r));for(const[n,d]of originals){if(d)Object.defineProperty(globalThis,n,d);else delete globalThis[n];}assert.deepEqual(errors,[]);});
  localStorage.setItem('listenwrite-supabase-session-v1',JSON.stringify({access_token:'mock-existing-access',refresh_token:'mock-existing-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'jiaxinliu694@gmail.com'}}));
  const storage=await import('../src/storage.js');
  const state=storage.defaultState();state.words=[{id:'w-v49',en:'leader',zh:'领导者',sources:['personal'],examples:[]}];
  state.events=[{id:'e-v49',wordId:'w-v49',mode:'listen',result:'bad',ts:1788663600000,date:'2026-09-06'}];
  const canonical=storage.canonicalizeCloudState(state);await storage.saveState(canonical);
  globalThis.fetch=async(url,opts)=>{
    calls.push({url,opts});
    if(url.endsWith('listenwrite_register_device_entry') || url.endsWith('listenwrite_revoke_device_entry')){
      assert.equal(opts.headers.Authorization,'Bearer mock-existing-access');
      const body=JSON.parse(opts.body);assert.deepEqual(Object.keys(body),['p_key_hash']);assert.match(body.p_key_hash,/^[a-f0-9]{64}$/);
      return {ok:true,status:200,json:async()=>({registered:true,revoked:true,user_id:uid,key_hash:body.p_key_hash})};
    }
    assert.ok(url.endsWith('listenwrite_pull_state'),'Only normal read is permitted outside entry management');
    return {ok:true,status:200,json:async()=>[{state:canonical,revision:49,state_updated_at:1}]};
  };
  const cloud=await import('../src/cloudsync.js?device-ui-v49');await cloud.initCloudSync();
  for(let i=0;i<100;i++){if(document.getElementById('cloudSyncTop')?.textContent==='云已同步')break;await new Promise(r=>setTimeout(r,10));}
  document.getElementById('cloudSyncTop').click();
  const create=document.getElementById('lwDeviceEntryCreate');assert.ok(create);
  assert.equal(document.getElementById('lwCloudPassword'),null);
  assert.equal(document.getElementById('lwCloudMagicLogin'),null);
  await create.onclick();
  const input=document.getElementById('lwDeviceEntryUrl');assert.match(input.value,/#lw_sync=[0-9a-f]{64}$/);
  assert.equal(input.readOnly,true);
  assert.equal(document.getElementById('lwDeviceEntryResult').hidden,false);
  assert.equal(document.getElementById('lwDeviceEntryPanel').dataset.cloudEditing,'true');
  const link=input.value;
  for(const interval of intervals)await interval();
  assert.equal(document.getElementById('lwDeviceEntryUrl'),input);
  assert.equal(input.value,link);
  assert.equal(calls.some(c=>c.url.includes('/auth/')),false);
  assert.equal(JSON.stringify(calls).includes(link.split('=')[1]),false);
  assert.deepEqual((await storage.readPersistedState()).events,canonical.events);
  assert.equal(JSON.stringify(await storage.readPersistedState()).includes('lw_sync'),false);
  await document.getElementById('lwDeviceEntryRevoke').onclick();
  assert.equal(input.value,'');
  assert.equal(document.getElementById('lwDeviceEntryResult').hidden,true);
  assert.equal(document.getElementById('lwDeviceEntryPanel').dataset.cloudEditing,'false');
});
