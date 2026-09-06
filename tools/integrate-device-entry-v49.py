from pathlib import Path
import subprocess
p=Path('src/cloudsync.js')
actual=subprocess.check_output(['git','hash-object',str(p)],text=True).strip()
if actual != '1e03cdbf53c1945445179ef8eae5f9f173b5d61a':
    raise SystemExit('cloudsync baseline changed; no integration applied')
s=p.read_text()
def replace(old,new):
    global s
    if s.count(old)!=1: raise SystemExit('Expected exactly one integration anchor: '+old[:80])
    s=s.replace(old,new,1)
s="import { createDeviceEntry } from './device-entry.js';\nimport { deviceEntryHtml, bindDeviceEntry } from './device-entry-ui.js';\n"+s
replace('let lastCloudCheck = 0;', '''const deviceEntries = createDeviceEntry({
  url: SUPABASE_URL, key: SUPABASE_KEY, appUrl: APP_URL, email: OWNER_EMAIL,
  ensureSession: () => auth.ensure(), refreshSession: () => auth.refresh(),
  peekSession: () => normalizeSession(readStored(SESSION_KEY)),
});
let lastCloudCheck = 0;''')
replace('async function cloudSignOut() {','async function cloudSignOut() {\n  deviceEntries.forget();')
replace(' : passwordSettings}`;', ' : deviceEntryHtml() + passwordSettings}`;')
replace("    const passwordForm = document.getElementById('lwCloudSetPasswordForm');", "    bindDeviceEntry({ entries: deviceEntries, setBusy: value => { authUiBusy = value; } });\n    const passwordForm = document.getElementById('lwCloudSetPasswordForm');")
replace('从个人入口打开，即可自动连接同一份词库，不需要密码或邮件。', '在仍能同步的手机或电脑上点「云同步 → 连接新设备」，然后在本机打开生成的直达链接，不需要密码或邮件。')
# Clipboard fallback for devices connected through an existing private link.
replace("      } catch { setStatus('ready', '浏览器不允许复制，请使用聊天里提供的个人入口。'); }", '''      } catch {
        const panel = document.getElementById('lwCloudMask');
        let field = document.getElementById('lwDirectCopyFallback');
        if (!field && panel) {
          field = document.createElement('input'); field.id = 'lwDirectCopyFallback';
          field.readOnly = true; field.type = 'text'; field.setAttribute('aria-label', '私人直达链接');
          panel.querySelector('.lw-cloud-panel').appendChild(field);
        }
        if (field) { field.value = value; field.focus(); field.select(); panel.dataset.cloudEditing = 'true'; }
        setStatus('ready', '浏览器不允许自动复制，请长按下面的网址复制到自己的另一台设备。');
      }''')
p.write_text(s)
print('Integrated signed-in device entry management; no live credential provisioned.')
