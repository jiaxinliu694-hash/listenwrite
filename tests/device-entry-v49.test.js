import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { createDeviceEntry, DEVICE_ENTRY_KEY } from '../src/device-entry.js';

const uid = '00000000-0000-4000-8000-000000000049';
const email = 'owner@example.test';
const session = () => ({ access_token: 'mock-access', refresh_token: 'mock-refresh', user: { id: uid, email } });
const ok = data => ({ ok: true, status: 200, json: async () => data });
function setup() {
  const data = new Map(), calls = [];
  let current = session();
  const storage = { getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  let handle = (url, opts) => ok({ registered: true, revoked: true, user_id: uid, key_hash: JSON.parse(opts.body).p_key_hash });
  const config = {
    url: 'https://db.example.test', key: 'mock-public-key', appUrl: 'https://app.example.test/', email,
    storage: () => storage, cryptoImpl: () => webcrypto,
    ensureSession: async () => current, peekSession: () => current,
    refreshSession: async () => { current = { ...current, access_token: 'mock-rotated' }; return current; },
    fetchImpl: async (url, opts) => { calls.push({url,opts}); return handle(url,opts); },
  };
  return { config, data, calls, client: createDeviceEntry(config), setSession: v => { current=v; }, setHandler: fn => { handle=fn; } };
}

test('v49 device generates private value locally and sends only its digest under an existing session', async () => {
  const f = setup();
  assert.equal(f.client.link(), null);
  const link = await f.client.issue();
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('lw_sync');
  assert.match(token, /^[a-f0-9]{64}$/);
  const digest = createHash('sha256').update(token).digest('hex');
  assert.notEqual(digest, token);
  assert.deepEqual(JSON.parse(f.calls[0].opts.body), { p_key_hash: digest });
  assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer mock-access');
  assert.equal(f.calls[0].opts.referrerPolicy, 'no-referrer');
  assert.equal(JSON.stringify(f.calls).includes(token), false);
  assert.equal(f.calls.some(c => /\/auth\/|listenwrite_direct_push|listenwrite_push_state|\/otp/.test(c.url)), false);
  assert.deepEqual([...f.data.keys()], [DEVICE_ENTRY_KEY]);
  assert.equal(f.client.link(), link);
});

test('v49 repeated clicks and reload reuse the same entry rather than minting more', async () => {
  const f = setup();
  const first = f.client.issue(), second = f.client.issue();
  assert.equal(first, second);
  const link = await first;
  assert.equal(f.calls.length, 1);
  const restored = createDeviceEntry(f.config);
  assert.equal(restored.link(), link);
  assert.equal(await restored.issue(), link);
  assert.equal(f.calls[0].opts.body, f.calls[1].opts.body);
});

test('v49 lost registration response preserves pending digest and retries without false success', async () => {
  const f = setup();
  f.setHandler(() => { throw new Error('mock offline'); });
  await assert.rejects(f.client.issue(), /网络暂时不可用/);
  assert.equal(f.client.link(), null);
  const original = f.calls[0].opts.body;
  f.setHandler((_url,opts) => ok({registered:true,user_id:uid,key_hash:JSON.parse(opts.body).p_key_hash}));
  await f.client.issue();
  assert.equal(f.calls[1].opts.body, original);
});

test('v49 no existing session, direct-only descriptor or wrong account cannot register any entry', async () => {
  for (const invalid of [null, {direct:true,user:{id:uid,email}}, {...session(),user:{id:uid,email:'other@example.test'}}]) {
    const f = setup(); f.setSession(invalid);
    await assert.rejects(f.client.issue(), /没有可用的原连接/);
    assert.equal(f.calls.length, 0);
    assert.equal(f.data.size, 0);
  }
});

test('v49 mismatched identity or malformed success never exposes an unconfirmed entry', async () => {
  for (const result of [{registered:true,user_id:'wrong',key_hash:'wrong'}, null, {}]) {
    const f = setup(); f.setHandler(() => ok(result));
    await assert.rejects(f.client.issue(), /确认不完整/);
    assert.equal(f.client.link(), null);
  }
});

test('v49 expired access token uses the original refresh mechanism, never mail or password grants', async () => {
  const f = setup(); let count=0;
  f.setHandler((_url,opts) => ++count===1
    ? {ok:false,status:401,json:async()=>({})}
    : ok({registered:true,user_id:uid,key_hash:JSON.parse(opts.body).p_key_hash}));
  await f.client.issue();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].opts.headers.Authorization, 'Bearer mock-rotated');
  assert.equal(f.calls[0].opts.body, f.calls[1].opts.body);
});

test('v49 disconnect during registration cannot save or display a late result', async () => {
  const f=setup(); let release, started;
  const ready=new Promise(r=>{started=r;});
  f.setHandler((_url,opts)=>new Promise(resolve=>{release=()=>resolve(ok({registered:true,user_id:uid,key_hash:JSON.parse(opts.body).p_key_hash}));started();}));
  const pending=f.client.issue(); await ready;
  f.setSession(null); f.client.forget(); release();
  await assert.rejects(pending,/连接已变化/);
  assert.equal(f.client.link(),null);
  assert.equal(f.data.has(DEVICE_ENTRY_KEY),false);
});

test('v49 explicit revocation is owner-authenticated and removes only the issued local entry', async () => {
  const f=setup(); f.data.set('learning-state','unchanged');
  await f.client.issue();
  const digest=JSON.parse(f.calls[0].opts.body).p_key_hash;
  await f.client.revoke();
  assert.match(f.calls.at(-1).url,/listenwrite_revoke_device_entry$/);
  assert.deepEqual(JSON.parse(f.calls.at(-1).opts.body),{p_key_hash:digest});
  assert.equal(f.client.link(),null);
  assert.equal(f.data.get('learning-state'),'unchanged');
});
