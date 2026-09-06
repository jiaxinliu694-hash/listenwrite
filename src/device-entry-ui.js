export function deviceEntryHtml() {
  return `<section id="lwDeviceEntryPanel" style="margin-top:16px"><h3>连接新设备</h3><p class="small">使用这台设备已有的连接，给 Edge 或另一台设备生成直达链接，不用密码或邮件。拿到完整链接的人能查看和修改词库，只发给自己的设备。</p><div class="lw-cloud-actions"><button id="lwDeviceEntryCreate" class="primary">连接新设备（生成直达链接）</button></div><div id="lwDeviceEntryResult" hidden><label class="lw-cloud-field">在另一台设备打开完整网址<input id="lwDeviceEntryUrl" type="text" readonly autocomplete="off" spellcheck="false" aria-label="私人直达链接"></label><div class="lw-cloud-actions"><button id="lwDeviceEntryCopy">复制直达链接</button></div><details style="margin-top:12px"><summary>入口管理</summary><p class="small">停用会断开所有使用这条链接的设备，但不删除任何学习记录。随后可重新生成。</p><button id="lwDeviceEntryRevoke">停用这条链接</button></details></div><p id="lwDeviceEntryStatus" role="status" class="small" style="margin-top:10px"></p></section>`;
}

export function bindDeviceEntry({ entries, setBusy = () => {}, documentImpl = globalThis.document, navigatorImpl = globalThis.navigator }) {
  const panel = documentImpl.getElementById('lwDeviceEntryPanel');
  if (!panel) return;
  const button = documentImpl.getElementById('lwDeviceEntryCreate');
  const output = documentImpl.getElementById('lwDeviceEntryResult');
  const input = documentImpl.getElementById('lwDeviceEntryUrl');
  const status = documentImpl.getElementById('lwDeviceEntryStatus');
  const copy = documentImpl.getElementById('lwDeviceEntryCopy');
  const revoke = documentImpl.getElementById('lwDeviceEntryRevoke');
  let working = false;
  function show(value) {
    input.value = value || ''; output.hidden = !value;
    panel.dataset.cloudEditing = value ? 'true' : 'false';
  }
  function busy(value) { working = value; setBusy(value); button.disabled = value; revoke.disabled = value; }
  async function copyLink() {
    if (!input.value) return;
    try {
      if (!navigatorImpl?.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigatorImpl.clipboard.writeText(input.value);
      status.textContent = '链接已复制，在 Edge 地址栏打开即可。不要发到公开群或公开仓库。';
    } catch {
      input.focus(); input.select();
      status.textContent = '入口已生成。浏览器不允许自动复制，请长按已选中的网址复制，在 Edge 打开。';
    }
  }
  show(entries.link());
  button.onclick = async () => {
    if (working) return;
    busy(true); panel.dataset.cloudEditing = 'true';
    status.textContent = '正在使用本机已有连接生成入口…';
    try {
      const value = await entries.issue();
      if (!panel.isConnected) return;
      show(value); await copyLink();
    } catch (error) {
      status.textContent = error?.message || '生成未完成，本机记录未改动。';
    } finally {
      busy(false); panel.dataset.cloudEditing = input.value ? 'true' : 'false';
    }
  };
  copy.onclick = copyLink;
  revoke.onclick = async () => {
    if (working) return;
    busy(true); status.textContent = '正在停用这条入口…';
    try {
      await entries.revoke(); show(null);
      status.textContent = '这条链接已停用，学习记录未删除。可重新点连接新设备生成新链接。';
    } catch (error) { status.textContent = error?.message || '停用未完成，入口仍保留。'; }
    finally { busy(false); }
  };
}
