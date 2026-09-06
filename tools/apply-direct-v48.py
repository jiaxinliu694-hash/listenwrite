from pathlib import Path
import hashlib
p=Path('src/cloudsync.js');s=p.read_text()
expected='e6f9dfc03a19ef10207c9ed2b30a8b2b4832d32e7c75c8867ee1a6579354e868'
assert hashlib.sha256(s.encode()).hexdigest()==expected, 'cloudsync baseline changed'
def replace(old,new):
    global s
    assert s.count(old)==1,(old[:100],s.count(old))
    s=s.replace(old,new,1)
s="import { createDirectCloud, DIRECT_KEY, DIRECT_PENDING_KEY } from './cloud-direct.js';\n"+s
replace("let lastCloudCheck = 0;", "const direct = createDirectCloud({ url: SUPABASE_URL, key: SUPABASE_KEY, appUrl: APP_URL, email: OWNER_EMAIL });\nlet lastCloudCheck = 0;")
replace("async function ensureSession() { return auth.ensure(); }", """async function ensureSession() {
  if (direct.present()) {
    const current = await direct.ensure();
    if (current) { session = current; updateCloudButton(); }
    return current;
  }
  return auth.ensure();
}""")
replace("  if (!current) throw new Error('请先登录云同步');", "  if (!current) throw new Error('此设备尚未连接云端；本机记录未改动。');\n  if (current.direct) return direct.rpc(path, body);")
replace("  return '云已登录';", "  return session.direct ? '自动同步' : '云已登录';")
replace("  const accessToken = session?.access_token;", "  const accessToken = session?.access_token;\n  direct.clear();")
replace("  const email = session?.user?.email || OWNER_EMAIL;", "  const directMode = direct.present();\n  const email = directMode ? '个人词库（无需密码或邮件）' : session?.user?.email || OWNER_EMAIL;")
replace('${passwordSettings}`;', '${directMode ? `<div class="lw-cloud-actions"><button id="lwDirectCopy">复制个人入口</button></div><p class="small">其他设备打开个人入口即可自动同步。入口包含访问权限，请勿转发给别人。</p>` : passwordSettings}`;')
replace("${session ? loggedIn : loggedOut}</div>`;", "${session || directMode ? loggedIn : `<p>从个人入口打开，即可自动连接同一份词库，不需要密码或邮件。</p><details id=\"lwLegacyLogin\"><summary>其他连接方式（旧版兼容）</summary>${loggedOut}</details>`}</div>`;")
replace("  if (session) {\n    document.getElementById('lwCloudNow')", "  if (session || directMode) {\n    document.getElementById('lwCloudNow')")
replace("    document.getElementById('lwCloudSetPasswordForm').onsubmit = async event => {", """    const copy = document.getElementById('lwDirectCopy');
    if (copy) copy.onclick = async () => {
      const value = direct.link();
      if (!value) { setStatus('pending', '正在自动连接，请稍后。'); return; }
      try {
        await navigator.clipboard.writeText(value);
        setStatus('synced', '个人入口已复制；在自己的另一台设备打开即可。');
      } catch { setStatus('ready', '浏览器不允许复制，请使用聊天里提供的个人入口。'); }
    };
    const passwordForm = document.getElementById('lwCloudSetPasswordForm');
    if (passwordForm) passwordForm.onsubmit = async event => {""")
replace("  if (!session && !readStored(SESSION_KEY)) return;", "  if (!session && !readStored(SESSION_KEY) && !direct.present()) return;")
replace("window.addEventListener('online', () => { auth.resetRetry(); periodicSync(true); });", "window.addEventListener('online', () => { auth.resetRetry(); direct.resetRetry(); periodicSync(true); });")
replace("    if (event.key !== SESSION_KEY) return;", """    if ([DIRECT_KEY, DIRECT_PENDING_KEY].includes(event.key)) {
      direct.adoptStorage();
      session = direct.peek() || normalizeSession(readStored(SESSION_KEY));
      setStatus('ready', direct.present() ? '已接收此浏览器的个人入口，正在自动同步。' : '此浏览器已断开自动同步，本机记录仍保留。');
      renderCloudModalIfOpen();
      if (direct.present() || session) periodicSync(true);
      return;
    }
    if (event.key !== SESSION_KEY || direct.present()) return;""")
replace("  session=normalizeSession(readStored(SESSION_KEY));\n  startObservers();\n  if(session) await periodicSync(true);", """  let entryError = null;
  try { direct.capture(); } catch (error) { entryError = error; }
  session=direct.peek() || normalizeSession(readStored(SESSION_KEY));
  if (direct.present()) setStatus('pending', '正在自动连接个人词库…');
  startObservers();
  if (entryError) { setStatus('error', entryError.message); return; }
  if(session || direct.present()) await periodicSync(true);""")
p.write_text(s)
print('Integrated no-prompt personal sync; learning and scheduling data unchanged.')
