import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';

test('v47 cloud dialog offers password login without mail and polling preserves input/errors', async t => {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div class="topbar"><div class="toolbar"></div></div></body></html>', {
    url: 'https://jiaxinliu694-hash.github.io/listenwrite/', pretendToBeVisual: true,
  });
  const names = ['window', 'document', 'location', 'history', 'localStorage', 'MutationObserver', 'indexedDB', 'fetch', 'setInterval'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const intervals = [], calls = [];
  for (const name of names.slice(0, 7)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name] });
  globalThis.indexedDB = indexedDB;
  globalThis.setInterval = fn => { intervals.push(fn); return { unref() {} }; };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: false, status: url.includes('/otp') ? 429 : 400,
      headers: { get: () => null }, json: async () => ({ code: url.includes('/otp') ? 'over_email_send_rate_limit' : 'invalid_credentials' }) };
  };
  t.after(() => {
    dom.window.close();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const cloud = await import('../src/cloudsync.js?ui-v47');
  await cloud.initCloudSync();
  document.getElementById('cloudSyncTop').click();
  const input = document.getElementById('lwCloudPassword');
  assert.ok(input, 'Password entry is primary, no mandatory mail');
  assert.equal(input.type, 'password');
  assert.ok(document.getElementById('lwCloudMagicLogin').closest('details'));
  assert.equal(document.querySelector('details').open, false);
  input.value = 'test-only-wrong-password';
  input.focus();
  for (const interval of intervals) await interval();
  assert.equal(document.getElementById('lwCloudPassword'), input);
  assert.equal(input.value, 'test-only-wrong-password');
  assert.equal(calls.length, 0);
  const form = document.getElementById('lwCloudPasswordForm');
  await form.onsubmit({ preventDefault() {}, currentTarget: form });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /grant_type=password$/);
  assert.match(document.getElementById('lwCloudStatus').textContent, /同步密码不正确/);
  input.blur();
  for (const interval of intervals) await interval();
  assert.match(document.getElementById('lwCloudStatus').textContent, /同步密码不正确/);
  assert.equal(input.value, 'test-only-wrong-password');
  assert.equal(localStorage.getItem('listenwrite-supabase-session-v1'), null);
  assert.equal([...Array(localStorage.length)].some((_, i) => (localStorage.getItem(localStorage.key(i)) || '').includes('test-only-wrong-password')), false);
  await document.getElementById('lwCloudMagicLogin').onclick();
  assert.match(document.getElementById('lwCloudStatus').textContent, /邮件发送额度已用完/);
  assert.equal(document.getElementById('lwCloudMagicLogin').disabled, true);
  await document.getElementById('lwCloudMagicLogin').onclick();
  for (const interval of intervals) await interval();
  assert.equal(calls.filter(call => call.url.includes('/otp')).length, 1);
  assert.match(document.getElementById('lwCloudStatus').textContent, /邮件发送额度已用完/);
  assert.equal(calls.some(call => call.url.includes('/rest/')), false, 'Failed login never changes learning state');
  let cleanUrl = '';
  const ok = cloud.captureSupabaseAuthCallback({
    location: { pathname: '/listenwrite/', search: '', hash: '#error=access_denied&error_code=otp_expired' },
    history: { replaceState(_a, _b, url) { cleanUrl = url; } }, localStorage,
  });
  assert.equal(ok, false);
  assert.equal(cleanUrl, '/listenwrite/');
  assert.match(document.getElementById('lwCloudStatus').textContent, /邮件链接已失效/);
  document.getElementById('lwCloudLocalOnly').click();
  assert.equal(document.getElementById('lwCloudMask'), null);
});
