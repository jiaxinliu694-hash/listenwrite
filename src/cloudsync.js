const SUPABASE_URL = 'https://bsuilpygojnqxntrxgnm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y_nFcIW0Sg0pB2zEhMU50g_LVQMX2Am';
const SESSION_KEY = 'listenwrite-supabase-session-v1';
const META_KEY = 'listenwrite-cloud-meta-v1';
const DB_NAME = 'listenwrite-v3';
const DB_VERSION = 1;
const STORE = 'kv';
const STATE_KEY = 'state';
const POLL_MS = 5000;
const CLOUD_POLL_MS = 15000;

let session = null;
let syncStatus = 'offline';
let syncMessage = '未登录云同步';
let conflict = null;
let syncBusy = false;
let lastCloudCheck = 0;
let dbPromise = null;

function nowSec() { return Math.floor(Date.now() / 1000); }
function parseJson(text, fallback = null) { try { return JSON.parse(text); } catch { return fallback; } }
function readStored(key) { try { return parseJson(localStorage.getItem(key) || '', null); } catch { return null; } }
function writeStored(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export function stateFingerprint(state) {
  const text = JSON.stringify(state || null);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${text.length}:${(h >>> 0).toString(16)}`;
}

export function hasCloudUserData(state) {
  if (!state || typeof state !== 'object') return false;
  if ((state.texts || []).length) return true;
  if ((state.events || []).length) return true;
  if ((state.activities || []).length) return true;
  if ((state.simpleWords || []).length || (state.errorBooks || []).length) return true;
  if (Object.keys(state.dailyPlans || {}).length) return true;
  if ((state.sentenceBooks || []).some((book) => (book?.entries || []).length)) return true;
  if ((state.words || []).some((word) => !String(word?.id || '').startsWith('sample_'))) return true;
  const chart = state.dataChart;
  if (chart && typeof chart === 'object') {
    const stack = [chart];
    const seen = new Set();
    while (stack.length) {
      const value = stack.pop();
      if (!value || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      if (Array.isArray(value)) {
        if (value.length) return true;
        continue;
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child) && child.length) return true;
        if (child && typeof child === 'object') stack.push(child);
      }
    }
  }
  return false;
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function localStateGet() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(STATE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function localStateSet(value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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
  session = null;
  conflict = null;
  syncStatus = 'offline';
  syncMessage = '未登录云同步';
  writeStored(SESSION_KEY, null);
  updateCloudButton();
}

async function authRequest(path, body) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `请求失败 ${response.status}`);
  return data;
}

async function refreshSession() {
  if (!session?.refresh_token) return null;
  try {
    const data = await authRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    return saveSession(data);
  } catch (error) {
    clearSession();
    throw error;
  }
}

async function ensureSession() {
  if (!session) session = normalizeSession(readStored(SESSION_KEY));
  if (!session) return null;
  if (Number(session.expires_at || 0) <= nowSec() + 60) await refreshSession();
  return session;
}

async function rpcRequest(path, body = {}) {
  const current = await ensureSession();
  if (!current) throw new Error('请先登录云同步');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${current.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    await refreshSession();
    return rpcRequest(path, body);
  }
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
    p_state: state,
    p_state_updated_at: Date.now(),
    p_expected_revision: expectedRevision,
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function metaForUser() {
  const meta = readStored(META_KEY) || {};
  const uid = session?.user?.id || null;
  return meta.userId === uid ? meta : { userId: uid, revision: 0, lastSyncedHash: null, cloudUpdatedAt: 0 };
}

function saveMeta(meta) {
  writeStored(META_KEY, { ...meta, userId: session?.user?.id || meta.userId || null });
}

function cloudLabel() {
  if (!session) return '云同步';
  if (syncStatus === 'conflict') return '云冲突';
  if (syncStatus === 'syncing') return '同步中';
  if (syncStatus === 'error') return '云异常';
  if (syncStatus === 'synced') return '云已同步';
  return '云已登录';
}

function updateCloudButton() {
  const button = document.getElementById('cloudSyncTop');
  if (!button) return;
  button.textContent = cloudLabel();
  button.classList.toggle('cloud-alert', syncStatus === 'conflict' || syncStatus === 'error');
}

function setStatus(status, message) {
  syncStatus = status;
  syncMessage = message || '';
  updateCloudButton();
  const statusEl = document.getElementById('lwCloudStatus');
  if (statusEl) statusEl.textContent = syncMessage;
}

async function applyCloudState(row) {
  if (!row?.state) throw new Error('云端还没有学习记录');
  await localStateSet(row.state);
  saveMeta({
    userId: session.user.id,
    revision: Number(row.revision) || 0,
    lastSyncedHash: stateFingerprint(row.state),
    cloudUpdatedAt: Number(row.state_updated_at) || 0,
  });
  setStatus('synced', '已从云端恢复，正在重新载入');
  location.reload();
}

async function overwriteCloudWithLocal(local, cloud = null) {
  const expected = cloud ? Number(cloud.revision) || 0 : null;
  const result = await pushCloud(local, expected);
  if (result?.status === 'conflict') {
    conflict = { local, cloud: { state: result.cloud_state, state_updated_at: result.cloud_updated_at, revision: result.revision } };
    setStatus('conflict', '云端和本机都有新记录，请选择保留哪一份');
    return false;
  }
  saveMeta({
    userId: session.user.id,
    revision: Number(result?.revision) || 1,
    lastSyncedHash: stateFingerprint(local),
    cloudUpdatedAt: Number(result?.cloud_updated_at) || Date.now(),
  });
  conflict = null;
  setStatus('synced', '已同步到云端');
  return true;
}

export async function reconcileCloud({ force = false } = {}) {
  if (syncBusy) return;
  const current = await ensureSession().catch(() => null);
  if (!current) return setStatus('offline', '未登录云同步');
  syncBusy = true;
  setStatus('syncing', '正在检查云端…');
  try {
    const local = await localStateGet();
    const localHash = stateFingerprint(local);
    const localHasData = hasCloudUserData(local);
    const meta = metaForUser();
    const shouldCheckCloud = force || Date.now() - lastCloudCheck >= CLOUD_POLL_MS || !meta.revision;
    let cloud = null;
    if (shouldCheckCloud) {
      cloud = await pullCloud();
      lastCloudCheck = Date.now();
    }

    if (!cloud && shouldCheckCloud) {
      if (localHasData) await overwriteCloudWithLocal(local, null);
      else setStatus('ready', '已登录；当前本机和云端都还没有学习记录');
      return;
    }

    if (!shouldCheckCloud) {
      if (meta.lastSyncedHash && localHash !== meta.lastSyncedHash) {
        const result = await pushCloud(local, Number(meta.revision) || null);
        if (result?.status === 'conflict') {
          conflict = { local, cloud: { state: result.cloud_state, state_updated_at: result.cloud_updated_at, revision: result.revision } };
          setStatus('conflict', '另一台设备也有新记录，请选择保留哪一份');
          return;
        }
        saveMeta({
          userId: current.user.id,
          revision: Number(result?.revision) || meta.revision,
          lastSyncedHash: localHash,
          cloudUpdatedAt: Number(result?.cloud_updated_at) || Date.now(),
        });
        setStatus('synced', '已自动同步');
      } else setStatus('synced', '已同步');
      return;
    }

    const cloudRevision = Number(cloud?.revision) || 0;
    const sameUserMeta = (readStored(META_KEY) || {}).userId === current.user.id;
    if (!localHasData && cloud?.state) return applyCloudState(cloud);

    if (!sameUserMeta && localHasData && cloud?.state) {
      conflict = { local, cloud };
      setStatus('conflict', '本机和云端都有记录，请先选择保留哪一份');
      return;
    }

    if (meta.lastSyncedHash === localHash) {
      if (cloudRevision > Number(meta.revision || 0)) return applyCloudState(cloud);
      saveMeta({ ...meta, userId: current.user.id, revision: cloudRevision, cloudUpdatedAt: Number(cloud.state_updated_at) || meta.cloudUpdatedAt, lastSyncedHash: localHash });
      setStatus('synced', '已同步');
      return;
    }

    if (cloudRevision === Number(meta.revision || 0)) {
      await overwriteCloudWithLocal(local, cloud);
      return;
    }

    conflict = { local, cloud };
    setStatus('conflict', '本机和云端都有新记录，请选择保留哪一份');
  } catch (error) {
    console.error('Listenwrite cloud sync failed', error);
    setStatus('error', error?.message || '云同步失败');
  } finally {
    syncBusy = false;
    renderCloudModalIfOpen();
  }
}

async function cloudSignIn(email, password) {
  const data = await authRequest('/auth/v1/token?grant_type=password', { email, password });
  saveSession(data);
  conflict = null;
  await reconcileCloud({ force: true });
}

async function cloudSignUp(email, password) {
  const data = await authRequest('/auth/v1/signup', { email, password });
  if (data?.access_token) {
    saveSession(data);
    await reconcileCloud({ force: true });
    return '注册并登录成功';
  }
  return '注册成功。请先去邮箱确认账号，再回来登录。';
}

async function cloudSignOut() {
  try {
    if (session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
      });
    }
  } catch {}
  clearSession();
  renderCloudModalIfOpen();
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectStyles() {
  if (document.getElementById('lwCloudStyles')) return;
  const style = document.createElement('style');
  style.id = 'lwCloudStyles';
  style.textContent = `
  .cloud-alert{border-color:#c66559!important;color:#9f463d!important}
  .lw-cloud-mask{position:fixed;inset:0;z-index:9998;background:rgba(35,33,28,.36);display:flex;align-items:flex-end;justify-content:center;padding:18px}
  .lw-cloud-panel{width:min(560px,100%);max-height:84vh;overflow:auto;background:#fffdf8;border:1px solid rgba(90,80,65,.16);border-radius:24px;padding:20px;box-shadow:0 22px 70px rgba(20,18,14,.2)}
  .lw-cloud-panel h2{margin:0 0 6px;font-size:24px}.lw-cloud-panel p{color:#76776f;line-height:1.6;margin:0 0 14px}
  .lw-cloud-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lw-cloud-field{display:grid;gap:6px;margin:10px 0}.lw-cloud-field input{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid #d8d3ca;border-radius:13px;background:#fff;font:inherit}
  .lw-cloud-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.lw-cloud-actions button{padding:10px 14px;border-radius:13px;border:1px solid #d8d3ca;background:#fff;font:inherit}.lw-cloud-actions .primary{background:#292a26;color:#fff;border-color:#292a26}
  .lw-cloud-status{padding:10px 12px;border-radius:13px;background:#f3efe7;margin:10px 0;color:#55574f}.lw-cloud-warning{background:#f9e9e6;color:#9f463d}
  @media(max-width:520px){.lw-cloud-grid{grid-template-columns:1fr}.lw-cloud-panel{padding:17px;border-radius:20px}.lw-cloud-mask{padding:10px}}
  `;
  document.head.appendChild(style);
}

function closeCloudModal() { document.getElementById('lwCloudMask')?.remove(); }
function renderCloudModalIfOpen() { if (document.getElementById('lwCloudMask')) openCloudModal(); }

function openCloudModal() {
  closeCloudModal();
  const mask = document.createElement('div');
  mask.id = 'lwCloudMask';
  mask.className = 'lw-cloud-mask';
  const email = session?.user?.email || '';
  const conflictHtml = conflict ? '<div class="lw-cloud-status lw-cloud-warning"><b>检测到两份不同记录</b><br>请选择“使用云端”或“上传本机”。选择前不会自动覆盖任何一边。</div>' : '';
  mask.innerHTML = `<div class="lw-cloud-panel" role="dialog" aria-modal="true">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><h2>云同步</h2><p>Supabase 只保存你的学习状态；本地 IndexedDB 仍然保留。电脑、iPhone Safari 和主屏幕 App 用同一账号即可同步。</p></div><button id="lwCloudClose" aria-label="关闭" style="border:0;background:transparent;font-size:24px">×</button></div>
    ${session ? `<div class="lw-cloud-status" id="lwCloudStatus">${esc(syncMessage)}</div>${conflictHtml}<div class="small">已登录：${esc(email)}</div><div class="lw-cloud-actions"><button id="lwCloudNow" class="primary">立即同步</button><button id="lwCloudPull">使用云端</button><button id="lwCloudPush">上传本机</button><button id="lwCloudLogout">退出云同步</button></div><p style="margin-top:12px">“使用云端”会用云端完整状态替换当前浏览器本地状态；“上传本机”会把当前浏览器状态覆盖到云端。正常情况下不需要手动点，系统会自动同步。</p>` : `<div class="lw-cloud-grid"><label class="lw-cloud-field">邮箱<input id="lwCloudEmail" type="email" autocomplete="email" placeholder="你的邮箱"></label><label class="lw-cloud-field">密码<input id="lwCloudPassword" type="password" autocomplete="current-password" placeholder="至少 6 位"></label></div><div class="lw-cloud-status" id="lwCloudStatus">${esc(syncMessage)}</div><div class="lw-cloud-actions"><button id="lwCloudLogin" class="primary">登录</button><button id="lwCloudSignup">注册账号</button></div><p style="margin-top:12px">第一次建议在“有原记录”的设备登录，让它先上传；然后在 iPhone Safari 登录同一账号，空库会自动从云端恢复。</p>`}
  </div>`;
  mask.addEventListener('click', (event) => { if (event.target === mask) closeCloudModal(); });
  document.body.appendChild(mask);
  document.getElementById('lwCloudClose').onclick = closeCloudModal;

  if (session) {
    document.getElementById('lwCloudNow').onclick = () => reconcileCloud({ force: true });
    document.getElementById('lwCloudPull').onclick = async () => {
      try {
        setStatus('syncing', '正在读取云端…');
        const cloud = conflict?.cloud || await pullCloud();
        if (!cloud?.state) throw new Error('云端还没有学习记录');
        await applyCloudState(cloud);
      } catch (error) { setStatus('error', error.message); }
    };
    document.getElementById('lwCloudPush').onclick = async () => {
      try {
        setStatus('syncing', '正在上传本机…');
        const local = conflict?.local || await localStateGet();
        const cloud = conflict?.cloud || await pullCloud();
        await overwriteCloudWithLocal(local, cloud);
        conflict = null;
        renderCloudModalIfOpen();
      } catch (error) { setStatus('error', error.message); }
    };
    document.getElementById('lwCloudLogout').onclick = cloudSignOut;
  } else {
    const credentials = () => ({
      email: document.getElementById('lwCloudEmail').value.trim(),
      password: document.getElementById('lwCloudPassword').value,
    });
    document.getElementById('lwCloudLogin').onclick = async () => {
      const { email: value, password } = credentials();
      if (!value || !password) return setStatus('error', '请输入邮箱和密码');
      try { setStatus('syncing', '正在登录…'); await cloudSignIn(value, password); openCloudModal(); }
      catch (error) { setStatus('error', error.message); }
    };
    document.getElementById('lwCloudSignup').onclick = async () => {
      const { email: value, password } = credentials();
      if (!value || password.length < 6) return setStatus('error', '请输入邮箱，密码至少 6 位');
      try {
        setStatus('syncing', '正在注册…');
        const message = await cloudSignUp(value, password);
        setStatus(session ? 'synced' : 'ready', message);
        openCloudModal();
      } catch (error) { setStatus('error', error.message); }
    };
  }
}

function ensureCloudButton() {
  const toolbar = document.querySelector('.topbar .toolbar');
  if (!toolbar || document.getElementById('cloudSyncTop')) return;
  const button = document.createElement('button');
  button.id = 'cloudSyncTop';
  button.className = 'soft';
  button.textContent = cloudLabel();
  button.onclick = openCloudModal;
  toolbar.prepend(button);
  updateCloudButton();
}

async function periodicSync(force = false) {
  if (document.hidden && !force) return;
  await reconcileCloud({ force }).catch(() => {});
}

function startObservers() {
  injectStyles();
  ensureCloudButton();
  const observer = new MutationObserver(ensureCloudButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const timer = setInterval(() => periodicSync(false), POLL_MS);
  timer?.unref?.();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) periodicSync(true); });
  window.addEventListener('online', () => periodicSync(true));
}

export async function initCloudSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof indexedDB === 'undefined') return;
  session = normalizeSession(readStored(SESSION_KEY));
  startObservers();
  if (session) await periodicSync(true);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  queueMicrotask(() => initCloudSync().catch((error) => {
    console.error('Listenwrite cloud init failed', error);
    setStatus('error', error?.message || '云同步初始化失败');
  }));
}
