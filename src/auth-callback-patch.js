const SESSION_KEY='listenwrite-supabase-session-v1';

function decodeJwtPayload(token){
  try{
    const part=String(token||'').split('.')[1];
    if(!part)return null;
    const base64=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');
    return JSON.parse(decodeURIComponent(Array.from(atob(base64),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
  }catch{return null;}
}

export function captureSupabaseAuthCallback(env={}){
  const loc=env.location||globalThis.location;
  const hist=env.history||globalThis.history;
  const storage=env.localStorage||globalThis.localStorage;
  if(!loc?.hash||!storage)return false;
  const params=new URLSearchParams(loc.hash.replace(/^#/,''));
  const access_token=params.get('access_token');
  const refresh_token=params.get('refresh_token');
  if(!access_token||!refresh_token)return false;
  const payload=decodeJwtPayload(access_token)||{};
  const expires_in=Number(params.get('expires_in'))||3600;
  const expires_at=Number(payload.exp)||Math.floor(Date.now()/1000)+expires_in;
  const existing=(()=>{try{return JSON.parse(storage.getItem(SESSION_KEY)||'null');}catch{return null;}})();
  const user={...(existing?.user||{}),id:payload.sub||existing?.user?.id||null,email:payload.email||existing?.user?.email||null};
  storage.setItem(SESSION_KEY,JSON.stringify({access_token,refresh_token,expires_in,expires_at,token_type:params.get('token_type')||'bearer',user}));
  hist?.replaceState?.(null,'',loc.pathname+loc.search);
  return true;
}

if(typeof window!=='undefined')captureSupabaseAuthCallback();
