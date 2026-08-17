import test from 'node:test';
import assert from 'node:assert/strict';
import { captureSupabaseAuthCallback } from '../src/auth-callback-patch.js';

function jwt(payload){
  const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${enc({alg:'none'})}.${enc(payload)}.`;
}

test('email confirmation callback stores user identity before cloud sync starts',()=>{
  const access=jwt({sub:'user-123',email:'me@example.com',exp:2000000000});
  const data=new Map();
  const localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))};
  let replaced='';
  const ok=captureSupabaseAuthCallback({
    location:{hash:`#access_token=${access}&refresh_token=refresh-1&expires_in=3600&token_type=bearer`,pathname:'/listenwrite/',search:''},
    history:{replaceState(_a,_b,url){replaced=url;}},
    localStorage,
  });
  assert.equal(ok,true);
  const stored=JSON.parse(data.get('listenwrite-supabase-session-v1'));
  assert.equal(stored.user.id,'user-123');
  assert.equal(stored.user.email,'me@example.com');
  assert.equal(stored.refresh_token,'refresh-1');
  assert.equal(replaced,'/listenwrite/');
});
