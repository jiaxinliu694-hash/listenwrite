from pathlib import Path
import hashlib

p = Path('src/cloudsync.js')
s = p.read_text()
expected = 'aaf1874822f919b66e888f261fae5da651ab1e40'
raw = p.read_bytes()
assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == expected, 'cloudsync baseline changed'

def replace(old, new):
    global s
    assert s.count(old) == 1, (old[:100], s.count(old))
    s = s.replace(old, new, 1)

s = "import { createCloudAuth, authError } from './cloud-auth.js';\n" + s
replace('let refreshInFlight = null;', '''let authUiBusy = false;
let observersStarted = false;
const MAIL_COOLDOWN_KEY = 'listenwrite-mail-cooldown-v1';
const auth = createCloudAuth({
  url: SUPABASE_URL, key: SUPABASE_KEY, email: OWNER_EMAIL,
  readSession: () => {
    const stored = normalizeSession(readStored(SESSION_KEY));
    if (stored) session = stored;
    return session;
  },
  saveSession, clearSession,
});''')
a = s.index('async function authRequest(')
b = s.index('export function ownerOtpRequest()', a)
s = s[:a] + s[b:]
replace("if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `登录邮件发送失败 ${response.status}`);", "if (!response.ok) throw authError(data, response.status, Number(response.headers?.get?.('Retry-After')) || 0);")
a = s.index('async function refreshSession()')
b = s.index('async function rpcRequest(', a)
s = s[:a] + '''async function refreshSession() { return auth.refresh(); }
async function ensureSession() { return auth.ensure(); }

export async function signInOwnerWithPassword(password) { return auth.signIn(password); }
export async function setOwnerSyncPassword(password) { return auth.setPassword(password); }

''' + s[b:]
replace('const current = await ensureSession().catch(() => null);', 'const current = await ensureSession();')
a = s.index('async function cloudSignOut()')
b = s.index('function decodeJwtPayload(', a)
s = s[:a] + '''async function cloudSignOut() {
  const accessToken = session?.access_token;
  auth.invalidatePending();
  clearSession();
  renderCloudModalIfOpen();
  if (accessToken) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
        method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
      });
    } catch {} // Local sign-out remains effective if the network is unavailable.
  }
}

''' + s[b:]
replace("  if (!loc?.hash || !storage) return false;\n  const params = new URLSearchParams(loc.hash.replace(/^#/, ''));", '''  if (!loc || !storage) return false;
  const params = new URLSearchParams(String(loc.hash || '').replace(/^#/, ''));
  const query = new URLSearchParams(loc.search || '');
  const errorCode = params.get('error_code') || query.get('error_code');
  if (errorCode || params.has('error') || query.has('error')) {
    const error = authError({ code: errorCode || 'auth_callback_failed' }, 400);
    setStatus('error', error.message);
    for (const key of ['error', 'error_code', 'error_description']) query.delete(key);
    hist?.replaceState?.(null, '', loc.pathname + (query.size ? `?${query}` : ''));
    return false;
  }
  if (!loc.hash) return false;''')
replace("function renderCloudModalIfOpen() { if (document.getElementById('lwCloudMask')) openCloudModal(); }", '''function renderCloudModalIfOpen() {
  const mask = document.getElementById('lwCloudMask');
  if (!mask || authUiBusy) return;
  // A background poll must not erase a password while it is being typed.
  if ([...mask.querySelectorAll('input')].some(input => input.value || input === document.activeElement)) return;
  openCloudModal();
}''')
a = s.index('function openCloudModal()')
b = s.index('function ensureCloudButton()', a)
s = s[:a] + '''function mailButtonState() {
  const button = document.getElementById('lwCloudMagicLogin');
  if (!button) return;
  const remaining = Math.max(0, Math.ceil((Number(readStored(MAIL_COOLDOWN_KEY)) - Date.now()) / 1000));
  button.disabled = authUiBusy || remaining > 0;
  button.textContent = remaining ? `暂勿重发（${remaining} 秒）` : '发送备用登录邮件';
}

function openCloudModal() {
  closeCloudModal();
  const mask = document.createElement('div'); mask.id = 'lwCloudMask'; mask.className = 'lw-cloud-mask';
  const email = session?.user?.email || OWNER_EMAIL;
  const conflictHtml = conflict ? `<div class="lw-cloud-status lw-cloud-warning"><b>检测到两端都有修改</b><br>${esc(syncMessage)}</div>` : '';
  const passwordSettings = `<details style="margin-top:16px"><summary>设置或修改同步密码</summary><p class="small">在已登录的设备上设置一次，其他设备就能用这个密码连接，不必收登录邮件。不是修改 Gmail 密码。</p><form id="lwCloudSetPasswordForm"><label class="lw-cloud-field">新同步密码<input id="lwCloudNewPassword" type="password" autocomplete="new-password" minlength="8" required></label><label class="lw-cloud-field">确认新密码<input id="lwCloudConfirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><div class="lw-cloud-actions"><button type="submit" class="primary">保存同步密码</button></div></form></details>`;
  const loggedIn = `<div class="lw-cloud-status" id="lwCloudStatus" role="status">${esc(syncMessage)}</div>${conflictHtml}<div class="small">已连接：${esc(email)}</div><div class="lw-cloud-actions"><button id="lwCloudNow" class="primary">立即同步</button>${conflict ? '<button id="lwCloudMerge" class="primary">合并双方记录</button><button id="lwCloudBackup">下载云端备份</button>' : ''}<button id="lwCloudPull">使用云端</button><button id="lwCloudPush">上传本机</button><button id="lwCloudLogout">只退出本设备</button></div><p style="margin-top:12px">有冲突时优先合并。“使用云端 / 上传本机”是整份替换。</p>${passwordSettings}`;
  const loggedOut = `<p>私人云端账号：<b>${esc(OWNER_EMAIL)}</b></p><div class="lw-cloud-status" id="lwCloudStatus" role="status">${esc(syncMessage)}</div><form id="lwCloudPasswordForm"><input type="text" name="username" autocomplete="username" value="${esc(OWNER_EMAIL)}" readonly hidden><label class="lw-cloud-field">同步密码<input id="lwCloudPassword" name="password" type="password" autocomplete="current-password" required placeholder="听词账号密码，不是 Gmail 密码"></label><div class="lw-cloud-actions"><button id="lwCloudPasswordLogin" type="submit" class="primary">用密码连接</button><button id="lwCloudLocalOnly" type="button">继续本机学习</button></div></form><p style="margin-top:12px">连接后自动续期；暂时断网不会清除登录状态。没有或忘记同步密码，可在已经登录的设备中设置。</p><details><summary>备用：邮件登录</summary><p class="small">邮件可能被限流；密码连接不需要发送邮件。只在没有可用密码或已登录设备时使用。</p><div class="lw-cloud-actions"><button id="lwCloudMagicLogin">发送备用登录邮件</button></div></details>`;
  mask.innerHTML = `<div class="lw-cloud-panel" role="dialog" aria-modal="true" aria-label="云同步"><div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><h2>云同步</h2><p>学习与错词复习可直接使用本机数据。云同步只用于设备间交换记录，连接不会直接覆盖本机内容。</p></div><button id="lwCloudClose" aria-label="关闭" style="border:0;background:transparent;font-size:24px">×</button></div>${session ? loggedIn : loggedOut}</div>`;
  mask.addEventListener('click', event => { if (event.target === mask && !authUiBusy) closeCloudModal(); });
  document.body.appendChild(mask);
  document.getElementById('lwCloudClose').onclick = closeCloudModal;
  if (session) {
    document.getElementById('lwCloudNow').onclick = () => reconcileCloud({ force: true });
    if (document.getElementById('lwCloudMerge')) document.getElementById('lwCloudMerge').onclick = () => mergeConflict().catch(e => setStatus('error', e.message));
    if (document.getElementById('lwCloudBackup')) document.getElementById('lwCloudBackup').onclick = () => downloadJson(`listenwrite-cloud-conflict-${Date.now()}.json`, conflict.cloud.state);
    document.getElementById('lwCloudPull').onclick = () => useLatestCloudState().catch(e => setStatus('error', e.message));
    document.getElementById('lwCloudPush').onclick = () => overwriteCloudWithLocalState().catch(e => setStatus('error', e.message));
    document.getElementById('lwCloudLogout').onclick = cloudSignOut;
    document.getElementById('lwCloudSetPasswordForm').onsubmit = async event => {
      event.preventDefault();
      if (authUiBusy) return;
      const first = document.getElementById('lwCloudNewPassword');
      const second = document.getElementById('lwCloudConfirmPassword');
      if (first.value !== second.value) { setStatus('error', '两次密码输入不一致。'); return; }
      authUiBusy = true;
      const button = event.currentTarget.querySelector('button'); button.disabled = true;
      try {
        setStatus('ready', '正在保存同步密码…');
        await setOwnerSyncPassword(first.value);
        first.value = ''; second.value = '';
        setStatus('ready', '同步密码已保存；其他设备可以用它连接，不必发送登录邮件。');
      } catch (error) { setStatus('error', error.message); }
      finally { authUiBusy = false; button.disabled = false; }
    };
  } else {
    document.getElementById('lwCloudLocalOnly').onclick = closeCloudModal;
    document.getElementById('lwCloudPasswordForm').onsubmit = async event => {
      event.preventDefault();
      if (authUiBusy) return;
      authUiBusy = true;
      const input = document.getElementById('lwCloudPassword');
      const button = document.getElementById('lwCloudPasswordLogin'); button.disabled = true;
      let connected = false;
      try {
        setStatus('ready', '正在用密码连接…');
        await signInOwnerWithPassword(input.value);
        input.value = '';
        setStatus('ready', '已连接，正在核对两端记录…');
        connected = true;
      } catch (error) { setStatus('error', error.message); }
      finally { authUiBusy = false; button.disabled = false; }
      if (connected) { openCloudModal(); await reconcileCloud({ force: true }); }
    };
    document.getElementById('lwCloudMagicLogin').onclick = async () => {
      if (authUiBusy || Number(readStored(MAIL_COOLDOWN_KEY)) > Date.now()) return;
      authUiBusy = true;
      writeStored(MAIL_COOLDOWN_KEY, Date.now() + 60000);
      mailButtonState();
      try {
        setStatus('ready', '正在发送备用登录邮件…');
        await sendOwnerMagicLink();
        setStatus('ready', '邮件已发送。请在需要连接的浏览器打开最新链接；不要在其他设备先使用。');
      } catch (error) {
        if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
          writeStored(MAIL_COOLDOWN_KEY, Date.now() + Math.max(300, error.retryAfter || 0) * 1000);
        }
        setStatus('error', error.message || '邮件发送未完成，可改用同步密码。');
      } finally { authUiBusy = false; mailButtonState(); }
    };
    mailButtonState();
  }
}
''' + s[b:]
a = s.index('async function periodicSync(')
b = s.index('export async function initCloudSync()', a)
s = s[:a] + '''async function periodicSync(force = false) {
  mailButtonState();
  if (document.hidden && !force) return;
  if (authUiBusy || document.querySelector('#lwCloudMask input:focus')) return;
  // Do not poll/re-render a logged-out dialog: preserve errors and typed input.
  if (!session && !readStored(SESSION_KEY)) return;
  await reconcileCloud({ force }).catch(() => {});
}
function startObservers() {
  if (observersStarted) return;
  observersStarted = true;
  injectStyles(); ensureCloudButton();
  const observer = new MutationObserver(ensureCloudButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const timer = setInterval(() => periodicSync(false), POLL_MS); timer?.unref?.();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) periodicSync(true); });
  window.addEventListener('online', () => { auth.resetRetry(); periodicSync(true); });
  window.addEventListener('storage', event => {
    if (event.key !== SESSION_KEY) return;
    session = normalizeSession(readStored(SESSION_KEY));
    auth.invalidatePending();
    setStatus(session ? 'ready' : 'offline', session ? '已接收此浏览器其他标签页的登录状态。' : '本浏览器已退出云同步，本机记录仍然保留。');
    renderCloudModalIfOpen();
    if (session) periodicSync(true);
  });
}
''' + s[b:]
replace("if (typeof window==='undefined'||typeof document==='undefined'||typeof indexedDB==='undefined') return;", "if (typeof window==='undefined'||typeof document==='undefined') return;")
p.write_text(s)
print('Integrated password-first cloud authentication; learning state code unchanged.')
