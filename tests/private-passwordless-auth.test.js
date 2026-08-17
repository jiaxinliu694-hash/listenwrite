import test from 'node:test';
import assert from 'node:assert/strict';
import { OWNER_EMAIL, ownerOtpRequest, sendOwnerMagicLink } from '../src/private-passwordless-auth.js';

test('private cloud login is locked to the existing owner and cannot create users', () => {
  const req = ownerOtpRequest();
  assert.equal(OWNER_EMAIL, 'jiaxinliu694@gmail.com');
  assert.equal(req.body.email, OWNER_EMAIL);
  assert.equal(req.body.create_user, false);
  assert.match(req.url, /\/auth\/v1\/otp\?redirect_to=/);
  assert.match(decodeURIComponent(req.url), /https:\/\/jiaxinliu694-hash\.github\.io\/listenwrite\//);
});

test('magic-link sender posts the private owner request', async () => {
  let seen = null;
  const fakeFetch = async (url, options) => {
    seen = { url, options };
    return { ok: true, json: async () => ({}) };
  };
  await sendOwnerMagicLink(fakeFetch);
  assert.equal(seen.options.method, 'POST');
  assert.deepEqual(JSON.parse(seen.options.body), { email: OWNER_EMAIL, create_user: false });
});
