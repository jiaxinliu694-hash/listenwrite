import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudAuth, authError, isTerminalRefreshError } from '../src/cloud-auth.js';

const OWNER = 'owner@example.test';
const response = (data, status = 200, retry = '') => ({ ok: status >= 200 && status < 300, status,
  headers: { get: () => retry }, json: async () => data });
const session = (refresh = 'test-refresh', expires = 1) => ({
  access_token: `test-access-${refresh}`, refresh_token: refresh, expires_at: expires,
  user: { id: 'test-owner', email: OWNER },
});
function harness({ initial = null, handler } = {}) {
  let value = initial, time = 1000000, clears = 0;
  const saved = [], calls = [];
  const client = createCloudAuth({ url: 'https://example.test', key: 'public-test-key', email: OWNER,
    readSession: () => value,
    saveSession: data => { value = { ...data, expires_at: data.expires_at || time / 1000 + 3600 }; saved.push(value); return value; },
    clearSession: () => { clears += 1; value = null; },
    now: () => time, locks: () => null,
    fetchImpl: async (url, options) => { calls.push({ url, options }); return handler(url, options); },
  });
  return { client, calls, saved, read: () => value, clears: () => clears,
    replace: next => { value = next; }, advance: delta => { time += delta; } };
}

test('v47 password login uses the existing owner, preserves password bytes and never requests mail', async () => {
  const h = harness({ handler: async () => response(session('new', 4600)) });
  await h.client.signIn(' test-only-password ');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, 'https://example.test/auth/v1/token?grant_type=password');
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { email: OWNER, password: ' test-only-password ' });
  assert.equal(h.saved.length, 1);
  assert.equal(JSON.stringify(h.saved).includes('test-only-password'), false);
  assert.equal(h.calls.some(call => /otp|signup/.test(call.url)), false);
});

test('v47 bad/empty passwords and account mismatch do not clear an existing session', async () => {
  const old = session();
  const h = harness({ initial: old, handler: async () => response({ code: 'invalid_credentials' }, 400) });
  await assert.rejects(h.client.signIn(''), /请输入/);
  assert.equal(h.calls.length, 0);
  await assert.rejects(h.client.signIn('wrong'), /同步密码不正确/);
  assert.equal(h.read(), old);
  assert.equal(h.clears(), 0);
  const other = harness({ handler: async () => response({ ...session(), user: { id: 'other', email: 'other@example.test' } }) });
  await assert.rejects(other.client.signIn('test-password'), /账号不匹配/);
  assert.equal(other.saved.length, 0);
});

test('v47 network failure retains the refresh token, backs off and succeeds after recovery', async () => {
  let broken = true;
  const old = session();
  const h = harness({ initial: old, handler: async () => {
    if (broken) throw new TypeError('Failed to fetch');
    return response(session('renewed', 4600));
  } });
  await assert.rejects(h.client.ensure(), /已保留登录状态/);
  assert.equal(h.read(), old);
  assert.equal(h.clears(), 0);
  await assert.rejects(h.client.ensure());
  assert.equal(h.calls.length, 1, 'No five-second refresh storm');
  broken = false; h.advance(15001);
  assert.equal((await h.client.ensure()).refresh_token, 'renewed');
  assert.equal(h.calls.length, 2);
});

test('v47 server errors, malformed success and rate limits are not logout', async () => {
  for (const [status, data] of [[500, {}], [503, {}], [429, { code: 'over_request_rate_limit' }], [200, {}]]) {
    const old = session();
    const h = harness({ initial: old, handler: async () => response(data, status, '60') });
    await assert.rejects(h.client.ensure());
    assert.equal(h.read(), old);
    assert.equal(h.clears(), 0);
    h.advance(10000);
    await assert.rejects(h.client.ensure());
    assert.equal(h.calls.length, 1);
  }
});

test('v47 only explicit terminal refresh errors remove the failed device session', async () => {
  for (const code of ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired']) {
    const h = harness({ initial: session(), handler: async () => response({ error_code: code }, 400) });
    await assert.rejects(h.client.ensure(), /凭证已失效/);
    assert.equal(h.read(), null);
    assert.equal(h.clears(), 1);
    assert.equal(await h.client.ensure(), null);
  }
  assert.equal(isTerminalRefreshError(authError({}, 401)), false, 'An HTTP status alone is not proof of revocation');
});

test('v47 concurrent refresh calls share one request', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const h = harness({ initial: session(), handler: async () => { await wait; return response(session('next', 4600)); } });
  const first = h.client.ensure(); const second = h.client.ensure();
  release();
  assert.equal((await first).refresh_token, 'next');
  assert.equal((await second).refresh_token, 'next');
  assert.equal(h.calls.length, 1);
});

test('v47 a late refresh cannot resurrect a signed-out session or overwrite a new login', async () => {
  for (const replacement of [null, session('other-tab', 4600)]) {
    let release;
    const wait = new Promise(resolve => { release = resolve; });
    const h = harness({ initial: session(), handler: async () => { await wait; return response(session('stale', 4600)); } });
    const pending = h.client.ensure();
    h.replace(replacement); h.client.invalidatePending(); release();
    assert.equal(await pending, replacement);
    assert.equal(h.read(), replacement);
    assert.equal(h.saved.length, 0);
  }
});

test('v47 tabs re-read the latest token after acquiring the browser lock', async () => {
  let current = session(), calls = 0, locked = false;
  const fresh = session('other-tab', 4600);
  const client = createCloudAuth({ url: 'https://example.test', key: 'test', email: OWNER,
    readSession: () => current, saveSession: value => { current = value; return value; },
    clearSession: () => { current = null; }, now: () => 1000000,
    locks: () => ({ request: async (name, task) => { locked = true; assert.match(name, /auth-refresh/); current = fresh; return task(); } }),
    fetchImpl: async () => { calls += 1; return response(session('unnecessary', 4600)); },
  });
  assert.equal(await client.ensure(), fresh);
  assert.equal(locked, true);
  assert.equal(calls, 0);
});

test('v47 password changes require a valid owner session and only call the authenticated user endpoint', async () => {
  const h = harness({ initial: session('valid', 4600), handler: async () => response({ id: 'test-owner', email: OWNER }) });
  assert.equal(await h.client.setPassword('new-test-password'), true);
  assert.equal(h.calls[0].url, 'https://example.test/auth/v1/user');
  assert.equal(h.calls[0].options.method, 'PUT');
  assert.equal(h.calls[0].options.headers.Authorization, 'Bearer test-access-valid');
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { password: 'new-test-password' });
  assert.equal(h.saved.length, 0);
  assert.equal(h.clears(), 0);
  const anonymous = harness({ handler: async () => { throw new Error('must not call'); } });
  await assert.rejects(anonymous.client.setPassword('new-test-password'), /已登录/);
  assert.equal(anonymous.calls.length, 0);
});

test('v47 email quota error explains password alternative instead of blaming user clicks', () => {
  assert.match(authError({ code: 'over_email_send_rate_limit' }, 429).message, /邮件发送额度已用完/);
  assert.match(authError({ code: 'over_email_send_rate_limit' }, 429).message, /同步密码/);
  assert.match(authError({ code: 'otp_expired' }, 400).message, /邮件链接已失效/);
});
