// Device-link issuance requires the owner's existing Supabase session.
// Generate the bearer value only in that browser; send only its digest to the
// owner-authenticated registration RPC. Never include it in learning backups.
export const DEVICE_ENTRY_KEY = 'listenwrite-issued-device-entry-v1';
const HEX = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const SESSION_REQUIRED = '这台设备没有可用的原连接。请在仍显示云已连接的那台设备生成入口；不用在新设备输入密码。';

export function createDeviceEntry({ url, key, appUrl, email, ensureSession, refreshSession, peekSession,
  storage = () => globalThis.localStorage, cryptoImpl = () => globalThis.crypto,
  fetchImpl = (...args) => globalThis.fetch(...args),
}) {
  let memory = null, generation = 0, inFlight = null;
  const validSession = value => Boolean(value?.access_token && UUID.test(value.user?.id || '')
    && String(value.user?.email || '').toLowerCase() === email.toLowerCase());
  const read = () => {
    try {
      const value = memory || JSON.parse(storage()?.getItem(DEVICE_ENTRY_KEY) || 'null');
      return HEX.test(value?.key || '') && HEX.test(value?.keyHash || '') && UUID.test(value?.userId || '') ? value : null;
    } catch { return null; }
  };
  const save = value => {
    memory = value;
    try { if (value) storage()?.setItem(DEVICE_ENTRY_KEY, JSON.stringify(value)); else storage()?.removeItem(DEVICE_ENTRY_KEY); } catch {}
  };
  function assertContext(uid, version) {
    const current = peekSession();
    if (generation !== version || !validSession(current) || current.user.id !== uid) {
      throw new Error('设备连接已变化，未接收旧请求的结果。');
    }
  }
  async function ownerSession() {
    const current = await ensureSession();
    if (!validSession(current)) throw new Error(SESSION_REQUIRED);
    return current;
  }
  function entryLink(value) { return `${appUrl}#lw_sync=${value.key}`; }
  function link() {
    const value = read(), current = peekSession();
    return value?.registered && validSession(current) && value.userId === current.user.id ? entryLink(value) : null;
  }
  function forget() { generation += 1; save(null); }
  async function makeRecord(uid) {
    const crypto = cryptoImpl();
    if (!crypto?.getRandomValues || !crypto?.subtle?.digest) throw new Error('当前浏览器无法安全生成入口，请在 HTTPS 页面使用新版浏览器。');
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return { key: token, keyHash: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''), userId: uid, registered: false };
  }
  async function post(route, digest, initial, version, retried = false) {
    assertContext(initial.user.id, version);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000); timer?.unref?.();
    let response, data;
    try {
      response = await fetchImpl(`${url}/rest/v1/rpc/${route}`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${initial.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_key_hash: digest }), signal: controller.signal,
        cache: 'no-store', referrerPolicy: 'no-referrer',
      });
      data = await response.json().catch(() => null);
    } catch {
      throw new Error('网络暂时不可用，未清除原连接；恢复后再次点连接新设备即可，不会重复生成入口。');
    } finally { clearTimeout(timer); }
    assertContext(initial.user.id, version);
    if (response.status === 401 && !retried) {
      const refreshed = await refreshSession();
      if (!validSession(refreshed) || refreshed.user.id !== initial.user.id) throw new Error(SESSION_REQUIRED);
      return post(route, digest, refreshed, version, true);
    }
    if (!response.ok) {
      if (response.status === 401 || data?.code === '42501') throw new Error('原连接或入口不可用。只能由本人仍连接着的设备生成；本机记录未改动。');
      if (data?.code === '54000') throw new Error('已有较多有效入口，请先停用不再需要的入口。');
      throw new Error('入口暂未生成，请稍后重试；无需发送邮件，原词库未改动。');
    }
    if (!data || data.user_id !== initial.user.id || data.key_hash !== digest) throw new Error('服务器确认不完整，暂不显示入口，请重试。');
    return data;
  }
  function issue() {
    if (inFlight) return inFlight;
    const version = generation;
    const task = (async () => {
      const current = await ownerSession();
      assertContext(current.user.id, version);
      let value = read();
      if (!value || value.userId !== current.user.id) value = await makeRecord(current.user.id);
      assertContext(current.user.id, version);
      // Persist a pending record before the request. A lost response can safely
      // retry the same digest; registration is idempotent on the server.
      save(value);
      const result = await post('listenwrite_register_device_entry', value.keyHash, current, version);
      if (result.registered !== true) throw new Error('服务器未确认入口，稍后重试即可。');
      assertContext(current.user.id, version);
      value = { ...value, registered: true }; save(value);
      return entryLink(value);
    })();
    inFlight = task;
    task.finally(() => { if (inFlight === task) inFlight = null; }).catch(() => {});
    return task;
  }
  async function revoke() {
    if (inFlight) throw new Error('入口操作正在进行，请稍后。');
    const version = generation, current = await ownerSession(), value = read();
    if (!value || value.userId !== current.user.id) throw new Error('此设备没有生成过可停用的入口。');
    const task = post('listenwrite_revoke_device_entry', value.keyHash, current, version);
    inFlight = task;
    try {
      const result = await task;
      if (result.revoked !== true) throw new Error('服务器未确认停用，原入口仍保留。');
      assertContext(current.user.id, version); forget();
      return true;
    } finally { if (inFlight === task) inFlight = null; }
  }
  return { issue, link, revoke, forget };
}
