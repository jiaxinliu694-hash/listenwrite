import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectCloud, DIRECT_KEY, DIRECT_PENDING_KEY } from '../src/cloud-direct.js';
const secret = 'a'.repeat(64); // Synthetic; not a deployed credential.
const uid = '00000000-0000-4000-8000-000000000048';
function harness(handler) {
  const values = new Map(), calls = []; let time = 100000;
  const storage = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const options = { url: 'https://test.invalid', key: 'public-test', appUrl: 'https://app.invalid/', email: 'test@example.invalid', storage: () => storage, now: () => time,
    fetchImpl: async (url, options) => { calls.push({ url, ...options }); return handler ? handler(url, options) : { ok: true, status:200, json:async () => ({ connected:true,user_id:uid }) }; } };
  const cloud = createDirectCloud(options);
  const capture = value => { let clean; cloud.capture({location:{hash:`#lw_sync=${value}&view=home`,pathname:'/',search:'?v=48'},history:{replaceState(a,b,url){clean=url;}}}); return clean; };
  return { cloud, options, values, storage, calls, capture, advance: n => {time+=n;} };
}
test('v48 personal entry connects without password/mail and survives restart; secret is never in request URL', async () => {
  const h=harness(); assert.equal(h.capture(secret),'/?v=48#view=home');
  assert.equal(h.cloud.present(),true); assert.equal(h.cloud.peek(),null);
  assert.equal((await h.cloud.ensure()).user.id,uid); assert.equal(h.calls.length,1);
  assert.match(h.calls[0].url,/listenwrite_direct_connect$/); assert.equal(h.calls[0].headers.Authorization,undefined);
  assert.equal(h.calls[0].referrerPolicy,'no-referrer'); assert.equal(h.calls[0].url.includes(secret),false);
  assert.equal(h.calls.some(c=>c.url.includes('/auth/')),false); assert.equal(h.values.has(DIRECT_PENDING_KEY),false);
  const restarted=createDirectCloud(h.options); assert.equal((await restarted.ensure()).user.id,uid); assert.equal(h.calls.length,1);
  assert.equal(restarted.link(),`https://app.invalid/#lw_sync=${secret}`);
});
test('v48 scoped RPC ignores client-supplied identity and credential overrides; revision is always sent',async()=>{
  const h=harness();h.capture(secret);await h.cloud.ensure();
  await h.cloud.rpc('listenwrite_push_state',{p_state:{words:[],events:[]},p_state_updated_at:1,p_expected_revision:7,p_sync_key:'evil',user_id:'another'});
  const data=JSON.parse(h.calls.at(-1).body);assert.equal(data.p_sync_key,secret);assert.equal(data.p_expected_revision,7);assert.equal('user_id' in data,false);
  await h.cloud.rpc('listenwrite_push_state',{p_state:{words:[],events:[]}});assert.equal(JSON.parse(h.calls.at(-1).body).p_expected_revision,0);
  await assert.rejects(h.cloud.rpc('delete_everything'),/仅可同步/);
});
test('v48 incomplete links do not destroy saved access or write learning data',async()=>{
  const h=harness();h.capture(secret);await h.cloud.ensure();const before=h.values.get(DIRECT_KEY);
  assert.throws(()=>h.capture('bad'),/不完整/);assert.equal(h.values.get(DIRECT_KEY),before);
  assert.equal(h.cloud.capture({location:{hash:'#home'}}),false);assert.deepEqual([...h.values.keys()],[DIRECT_KEY]);
});
test('v48 offline retains pending entry and backs off before reconnecting',async()=>{
  let online=false; const h=harness(()=>{if(!online)throw new Error('offline');return {ok:true,status:200,json:async()=>({connected:true,user_id:uid})};});
  h.capture(secret);await assert.rejects(h.cloud.ensure(),/网络暂时/);assert.equal(h.cloud.present(),true);
  await assert.rejects(h.cloud.ensure());assert.equal(h.calls.length,1);
  online=true;h.advance(16000);assert.equal((await h.cloud.ensure()).user.id,uid);assert.equal(h.calls.length,2);
});
test('v48 revoked entry does not fall back to mail, password, or unprotected data',async()=>{
  const h=harness(()=>({ok:false,status:403,json:async()=>({code:'42501'})}));h.capture(secret);
  await assert.rejects(h.cloud.ensure(),/停用/);assert.equal(h.calls.length,1);assert.equal(h.cloud.peek(),null);
  assert.equal(h.calls.some(c=>c.url.includes('/auth/')),false);
});
test('v48 a late connection cannot resurrect a disconnected device',async()=>{
  let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));h.capture(secret);const task=h.cloud.ensure();h.cloud.clear();
  resolve({ok:true,status:200,json:async()=>({connected:true,user_id:uid})});assert.equal(await task,null);assert.equal(h.cloud.present(),false);assert.equal(h.values.size,0);
});
test('v48 connection changes are adopted across tabs; identity comes from the server',async()=>{
  const h=harness();h.capture(secret);await h.cloud.ensure();const other=createDirectCloud(h.options);
  assert.equal(other.peek().user.id,uid);h.storage.removeItem(DIRECT_KEY);other.adoptStorage();assert.equal(other.peek(),null);
});
