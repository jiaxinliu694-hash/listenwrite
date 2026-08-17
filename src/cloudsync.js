import {
  readPersistedState,
  applyRemoteState,
  hasUserData,
  readCloudSyncBase,
  saveCloudSyncBase,
  saveCloudConflictBackup,
} from './storage.js';
import { mergeCloudStates } from './cloudmerge.js';

const SUPABASE_URL = 'https://bsuilpygojnqxntrxgnm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y_nFcIW0Sg0pB2zEhMU50g_LVQMX2Am';
const APP_URL = 'https://jiaxinliu694-hash.github.io/listenwrite/';
export const OWNER_EMAIL = 'jiaxinliu694@gmail.com';
const SESSION_KEY = 'listenwrite-supabase-session-v1';
const META_KEY = 'listenwrite-cloud-meta-v1';
const POLL_MS = 5000;
const CLOUD_POLL_MS = 15000;

let session = null;
let syncStatus = 'offline';
let syncMessage = '未登录云同步';
let conflict = null;
let pendingRemote = null;
let syncBusy = false;
let refreshInFlight = null;
let lastCloudCheck = 0;

function nowSec() { return Math.floor(Date.now() / 1000); }
function parseJson(text, fallback = null) { try { return JSON.parse(text); } catch { return fallback; } }
function readStored(key) { try { return parseJson(localStorage.getItem(key) || '', null); } catch { return null; } }
function writeStored(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export function stateFingerprint(state) {
  const text = JSON.stringify(state || null);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${text.length}:${(h >>> 0).toString(16)}`;
}

export function hasCloudUserData(state) { return hasUserData(state); }

function normalizeSession(raw) {
  if (!raw?.access_token || !raw?.refresh_token) return null;
  const expiresAt = Number(raw.expires_at) || (nowSec() + Number(raw.expires_in || 3600));
  return { ...raw, expires_at: expiresAt };
}

function saveSession(raw) {
  session = normalizeSession(raw);
  writeStored(SESSION_KEY, session);
  updateCloudButton();
  return session;
}

function clearSession() {
  session = null; conflict = null; pendingRemote = null;
  syncStatus = 'offline'; syncMessage = '未登录云同步';
  writeStored(SESSION_KEY, null);
  updateCloudButton();
}

async function authRequest(path, body) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `请求失败 ${response.status}`);
  return data;
}

export function ownerOtpRequest() {
  return {
    url: `${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(APP_URL)}`,
    body: { email: OWNER_EMAIL, create_user: false },
  };
}

export async function sendOwnerMagicLink(fetchImpl = globalThis.fetch) {
  const { url, body } = ownerOtpRequest();
  const response = await fetchImpl(url, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `登录邮件发送失败 ${response.status}`);
  return data;
}

async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;
  if (!session?.refresh_token) return null;
  const token = session.refresh_token;
  refreshInFlight = (async () => {
    try {
      const data = await authRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: token });
      return saveSession(data);
    } catch (error) {
      clearSession();
      throw error;
    } finally { refreshInFlight = null; }
  })();
  return refreshInFlight;
}

async function ensureSession() {
  if (!session) session = normalizeSession(readStored(SESSION_KEY));
  if (!session) return null;
  if (Number(session.expires_at || 0) <= nowSec() + 60) await refreshSession();
  return session;
}

async function rpcRequest(path, body = {}, retried = false) {
  const current = await ensureSession();
  if (!current) throw new Error('请先登录云同步');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${path}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${current.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (response.status === 401 && !retried) { await refreshSession(); return rpcRequest(path, body, true); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.hint || `云端请求失败 ${response.status}`);
  return data;
}

async function pullCloud() {
  const rows = await rpcRequest('listenwrite_pull_state');
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function pushCloud(state, expectedRevision = null) {
  const rows = await rpcRequest('listenwrite_push_state', {
    p_state: state, p_state_updated_at: Date.now(), p_expected_revision: expectedRevision,
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function metaForUser() {
  const meta = readStored(META_KEY) || {};
  const uid = session?.user?.id || null;
  return meta.userId === uid ? meta : { userId: uid, revision: 0, lastSyncedHash: null, cloudUpdatedAt: 0 };
}
function saveMeta(meta) { writeStored(META_KEY, { ...meta, userId: session?.user?.id || meta.userId || null }); }

function cloudLabel() {
  if (!session) return '云同步';
  if (syncStatus === 'conflict') return '云冲突';
  if (syncStatus === 'pending') return '云端有更新';
  if (syncStatus === 'syncing') return '同步中';
  if (syncStatus === 'error') return '云异常';
  if (syncStatus === 'synced') return '云已同步';
  return '云已登录';
}
function updateCloudButton() {
  const button = typeof document !== 'undefined' ? document.getElementById('cloudSyncTop') : null;
  if (!button) return;
  button.textContent = cloudLabel();
  button.classList.toggle('cloud-alert', ['conflict', 'error', 'pending'].includes(syncStatus));
}
function setStatus(status, message) {
  syncStatus = status; syncMessage = message || ''; updateCloudButton();
  const statusEl = typeof document !== 'undefined' ? document.getElementById('lwCloudStatus') : null;
  if (statusEl) statusEl.textContent = syncMessage;
}

function busyWithStudy() {
  if (typeof document === 'undefined') return false;
  if (document.querySelector('.immersive')) return true;
  const active = document.activeElement;
  return Boolean(active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) && !active.closest('#lwCloudMask'));
}

async function rememberSyncedState(state, revision, updatedAt) {
  await saveCloudSyncBase(state);
  saveMeta({ userId: session.user.id, revision: Number(revision) || 0, lastSyncedHash: stateFingerprint(state), cloudUpdatedAt: Number(updatedAt) || 0 });
}

async function applyCloudState(row, { force = false } = {}) {
  if (!row?.state) throw new Error('云端还没有学习记录');
  if (!force && busyWithStudy()) {
    pendingRemote = row;
    setStatus('pending', '云端有新记录；当前学习结束后会应用，不会打断本轮');
    return false;
  }
  await rememberSyncedState(row.state, row.revision, row.state_updated_at);
  await applyRemoteState(row.state);
  setStatus('synced', '已应用云端记录');
  location.reload();
  return true;
}

async function acceptPush(local, result) {
  await rememberSyncedState(local, Number(result?.revision) || 1, Number(result?.cloud_updated_at) || Date.now());
  conflict = null; setStatus('synced', '已同步到云端');
}

async function pushLocal(local, expectedRevision = null) {
  const result = await pushCloud(local, expectedRevision);
  if (result?.status === 'conflict') {
    await prepareConflict(local, { state: result.cloud_state, state_updated_at: result.cloud_updated_at, revision: result.revision });
    return false;
  }
  await acceptPush(local, result);
  return true;
}

async function prepareConflict(local, cloud) {
  const base = await readCloudSyncBase();
  const merged = base ? mergeCloudStates(base, local, cloud?.state || {}) : null;
  conflict = { local, cloud, base, merged };
  await saveCloudConflictBackup({ createdAt: Date.now(), local, cloud, base, mergedConflicts: merged?.conflicts || [] });
  setStatus('conflict', merged ? `检测到双端修改；可安全合并学习记录${merged.conflicts.length ? `（另有 ${merged.conflicts.length} 处内容冲突）` : ''}` : '本机和云端都有记录，请选择保留哪一份');
}

async function mergeConflict() {
  if (!conflict?.cloud?.state) return;
  const base = conflict.base || await readCloudSyncBase();
  if (!base) throw new Error('缺少共同同步基线，不能自动合并；请先下载云端备份再选择一边');
  const merged = mergeCloudStates(base, conflict.local, conflict.cloud.state);
  const result = await pushCloud(merged.state, Number(conflict.cloud.revision) || null);
  if (result?.status === 'conflict') {
    await prepareConflict(await readPersistedState(), { state: result.cloud_state, state_updated_at: result.cloud_updated_at, revision: result.revision });
    return;
  }
  await rememberSyncedState(merged.state, result?.revision, result?.cloud_updated_at);
  await applyRemoteState(merged.state);
  setStatus('synced', merged.conflicts.length ? `已合并；${merged.conflicts.length} 处同时编辑以本机内容为准，云端原稿已留冲突备份` : '双方学习记录已合并');
  location.reload();
}

export async function reconcileCloud({ force = false } = {}) {
  if (syncBusy) return;
  const current = await ensureSession().catch(() => null);
  if (!current) return setStatus('offline', '未登录云同步');
  if (pendingRemote && !busyWithStudy()) return applyCloudState(pendingRemote, { force: true });
  syncBusy = true; setStatus('syncing', '正在检查云端…');
  try {
    const local = await readPersistedState();
    const localHash = stateFingerprint(local);
    const localHasData = hasUserData(local);
    const meta = metaForUser();
    const shouldCheckCloud = force || Date.now() - lastCloudCheck >= CLOUD_POLL_MS || !meta.revision;
    if (!shouldCheckCloud) {
      if (meta.lastSyncedHash && localHash !== meta.lastSyncedHash) await pushLocal(local, Number(meta.revision) || null);
      else setStatus('synced', '已同步');
      return;
    }

    const cloud = await pullCloud();
    lastCloudCheck = Date.now();
    if (!cloud) {
      if (localHasData) await pushLocal(local, null);
      else setStatus('ready', '已登录；本机和云端都还没有学习记录');
      return;
    }

    if (!localHasData) { await applyCloudState(cloud); return; }

    const cloudRevision = Number(cloud.revision) || 0;
    const sameUserMeta = (readStored(META_KEY) || {}).userId === current.user.id;
    if (!sameUserMeta || !meta.revision || !meta.lastSyncedHash) {
      if (localHash === stateFingerprint(cloud.state)) { await rememberSyncedState(local, cloudRevision, cloud.state_updated_at); setStatus('synced', '已同步'); }
      else await prepareConflict(local, cloud);
      return;
    }

    const localChanged = localHash !== meta.lastSyncedHash;
    const cloudChanged = cloudRevision > Number(meta.revision || 0);
    if (!localChanged && cloudChanged) { await applyCloudState(cloud); return; }
    if (localChanged && !cloudChanged) { await pushLocal(local, cloudRevision); return; }
    if (!localChanged && !cloudChanged) { setStatus('synced', '已同步'); return; }

    const base = await readCloudSyncBase();
    if (base) {
      const merged = mergeCloudStates(base, local, cloud.state);
      if (!merged.conflicts.length && !busyWithStudy()) {
        const result = await pushCloud(merged.state, cloudRevision);
        if (result?.status !== 'conflict') {
          await rememberSyncedState(merged.state, result?.revision, result?.cloud_updated_at);
          await applyRemoteState(merged.state);
          setStatus('synced', '已自动合并双方学习记录');
          location.reload();
          return;
        }
      }
    }
    await prepareConflict(local, cloud);
  } catch (error) {
    console.error('Listenwrite cloud sync failed', error);
    setStatus('error', error?.message || '云同步失败');
  } finally { syncBusy = false; renderCloudModalIfOpen(); }
}

async function cloudSignOut() {
  try {
    if (session?.access_token) await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` } });
  } catch {}
  clearSession(); renderCloudModalIfOpen();
}

function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = Array.from(atob(base64), c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
    return JSON.parse(decodeURIComponent(json));
  } catch { return null; }
}

export function captureSupabaseAuthCallback(env = {}) {
  const loc = env.location || globalThis.location;
  const hist = env.history || globalThis.history;
  const storage = env.localStorage || globalThis.localStorage;
  if (!loc?.hash || !storage) return false;
  const params = new URLSearchParams(loc.hash.replace(/^#/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const payload = decodeJwtPayload(access_token) || {};
  const expires_in = Number(params.get('expires_in')) || 3600;
  const expires_at = Number(payload.exp) || Math.floor(Date.now() / 1000) + expires_in;
  const existing = (() => { try { return JSON.parse(storage.getItem(SESSION_KEY) || 'null'); } catch { return null; } })();
  const user = { ...(existing?.user || {}), id: payload.sub || existing?.user?.id || null, email: payload.email || existing?.user?.email || OWNER_EMAIL };
  storage.setItem(SESSION_KEY, JSON.stringify({ access_token, refresh_token, expires_in, expires_at, token_type: params.get('token_type') || 'bearer', user }));
  hist?.replaceState?.(null, '', loc.pathname + loc.search);
  return true;
}

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function downloadJson(name, value) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function injectStyles() {
  if (document.getElementById('lwCloudStyles')) return;
  const style = document.createElement('style'); style.id = 'lwCloudStyles';
  style.textContent = `.cloud-alert{border-color:#c66559!important;color:#9f463d!important}.lw-cloud-mask{position:fixed;inset:0;z-index:9998;background:rgba(35,33,28,.36);display:flex;align-items:flex-end;justify-content:center;padding:18px}.lw-cloud-panel{width:min(600px,100%);max-height:84vh;overflow:auto;background:#fffdf8;border:1px solid rgba(90,80,65,.16);border-radius:24px;padding:20px;box-shadow:0 22px 70px rgba(20,18,14,.2)}.lw-cloud-panel h2{margin:0 0 6px;font-size:24px}.lw-cloud-panel p{color:#76776f;line-height:1.6;margin:0 0 14px}.lw-cloud-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lw-cloud-field{display:grid;gap:6px;margin:10px 0}.lw-cloud-field input{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid #d8d3ca;border-radius:13px;background:#fff;font:inherit}.lw-cloud-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.lw-cloud-actions button{padding:10px 14px;border-radius:13px;border:1px solid #d8d3ca;background:#fff;font:inherit}.lw-cloud-actions .primary{background:#292a26;color:#fff;border-color:#292a26}.lw-cloud-status{padding:10px 12px;border-radius:13px;background:#f3efe7;margin:10px 0;color:#55574f}.lw-cloud-warning{background:#f9e9e6;color:#9f463d}@media(max-width:520px){.lw-cloud-grid{grid-template-columns:1fr}.lw-cloud-panel{padding:17px;border-radius:20px}.lw-cloud-mask{padding:10px}}`;
  document.head.appendChild(style);
}
function closeCloudModal() { document.getElementById('lwCloudMask')?.remove(); }
function renderCloudModalIfOpen() { if (document.getElementById('lwCloudMask')) openCloudModal(); }

function openCloudModal() {
  closeCloudModal();
  const mask = document.createElement('div'); mask.id = 'lwCloudMask'; mask.className = 'lw-cloud-mask';
  const email = session?.user?.email || '当前账号';
  const conflictHtml = conflict ? `<div class="lw-cloud-status lw-cloud-warning"><b>检测到两端都有修改</b><br>${esc(syncMessage)}</div>` : '';
  mask.innerHTML = `<div class="lw-cloud-panel" role="dialog" aria-modal="true"><div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><h2>云同步</h2><p>本地仍然保存；云端负责电脑、Safari 和主屏幕 App 同步。双端同时修改时先保留双方快照，不再直接覆盖。</p></div><button id="lwCloudClose" style="border:0;background:transparent;font-size:24px">×</button></div>${session ? `<div class="lw-cloud-status" id="lwCloudStatus">${esc(syncMessage)}</div>${conflictHtml}<div class="small">已登录：${esc(email)}</div><div class="lw-cloud-actions"><button id="lwCloudNow" class="primary">立即同步</button>${conflict ? '<button id="lwCloudMerge" class="primary">合并双方记录</button><button id="lwCloudBackup">下载云端备份</button>' : ''}<button id="lwCloudPull">使用云端</button><button id="lwCloudPush">上传本机</button><button id="lwCloudLogout">只退出本设备</button></div><p style="margin-top:12px">有冲突时优先用“合并双方记录”。“使用云端 / 上传本机”属于整份替换，操作前系统已保存冲突快照。</p>` : `<p>私人云端账号：<b>${esc(OWNER_EMAIL)}</b></p><div class="lw-cloud-status" id="lwCloudStatus">${esc(syncMessage)}</div><div class="lw-cloud-actions"><button id="lwCloudMagicLogin" class="primary">发送登录邮件</button></div><p style="margin-top:12px">无需密码，也不提供注册入口。登录邮件只会发给这个已有账号。</p>`}</div>`;
  mask.addEventListener('click', e => { if (e.target === mask) closeCloudModal(); }); document.body.appendChild(mask);
  document.getElementById('lwCloudClose').onclick = closeCloudModal;
  if (session) {
    document.getElementById('lwCloudNow').onclick = () => reconcileCloud({ force: true });
    if (document.getElementById('lwCloudMerge')) document.getElementById('lwCloudMerge').onclick = () => mergeConflict().catch(e => setStatus('error', e.message));
    if (document.getElementById('lwCloudBackup')) document.getElementById('lwCloudBackup').onclick = () => downloadJson(`listenwrite-cloud-conflict-${Date.now()}.json`, conflict.cloud.state);
    document.getElementById('lwCloudPull').onclick = async () => { try { const cloud = conflict?.cloud || pendingRemote || await pullCloud(); if (!cloud?.state) throw new Error('云端还没有学习记录'); await saveCloudConflictBackup({ createdAt:Date.now(), local:await readPersistedState(), cloud }); await applyCloudState(cloud, { force: true }); } catch(e) { setStatus('error', e.message); } };
    document.getElementById('lwCloudPush').onclick = async () => { try { const local = conflict?.local || await readPersistedState(); const cloud = conflict?.cloud || await pullCloud(); if (cloud?.state) await saveCloudConflictBackup({ createdAt:Date.now(), local, cloud }); await pushLocal(local, cloud ? Number(cloud.revision)||null : null); } catch(e) { setStatus('error', e.message); } };
    document.getElementById('lwCloudLogout').onclick = cloudSignOut;
  } else {
  document.getElementById('lwCloudMagicLogin').onclick = async () => {
    const button = document.getElementById('lwCloudMagicLogin');
    if (button) button.disabled = true;
    try {
      setStatus('syncing', '正在发送登录邮件…');
      await sendOwnerMagicLink();
      setStatus('ready', '登录邮件已发送。打开 Gmail 点登录链接即可；不会创建新账号。');
    } catch (e) {
      setStatus('error', e?.message || '登录邮件发送失败');
      if (button) button.disabled = false;
    }
  };
}
}
function ensureCloudButton() {
  const toolbar = document.querySelector('.topbar .toolbar'); if (!toolbar || document.getElementById('cloudSyncTop')) return;
  const button = document.createElement('button'); button.id='cloudSyncTop'; button.className='soft'; button.textContent=cloudLabel(); button.onclick=openCloudModal; toolbar.prepend(button); updateCloudButton();
}
async function periodicSync(force=false) { if (document.hidden && !force) return; await reconcileCloud({force}).catch(()=>{}); }
function startObservers() {
  injectStyles(); ensureCloudButton(); const observer = new MutationObserver(ensureCloudButton); observer.observe(document.documentElement,{childList:true,subtree:true});
  const timer=setInterval(()=>periodicSync(false),POLL_MS);timer?.unref?.();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)periodicSync(true);}); window.addEventListener('online',()=>periodicSync(true));
}
export async function initCloudSync() {
  if (typeof window==='undefined'||typeof document==='undefined'||typeof indexedDB==='undefined') return;
  captureSupabaseAuthCallback();
  session=normalizeSession(readStored(SESSION_KEY));
  startObservers();
  if(session) await periodicSync(true);
}
if (typeof window!=='undefined'&&typeof document!=='undefined') queueMicrotask(()=>initCloudSync().catch(error=>{console.error('Listenwrite cloud init failed',error);setStatus('error',error?.message||'云同步初始化失败');}));
