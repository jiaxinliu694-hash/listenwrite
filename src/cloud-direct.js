// A revocable personal entry enables no-prompt sync. Never embed a real key in
// source, analytics, logs or learning backups. Only the state RPCs are exposed.
export const DIRECT_KEY = 'listenwrite-direct-sync-v1';
export const DIRECT_PENDING_KEY = 'listenwrite-direct-sync-pending-v1';
const TOKEN = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const ROUTES = Object.freeze({ listenwrite_pull_state: 'listenwrite_direct_pull', listenwrite_push_state: 'listenwrite_direct_push' });

export function createDirectCloud({ url, key, appUrl, email,
  storage = () => globalThis.localStorage,
  fetchImpl = (...args) => globalThis.fetch(...args), now = () => Date.now(),
}) {
  let memory = null, pending = null, connection = null, generation = 0;
  let retryAt = 0, failures = 0, lastError = null;
  const read = name => { try { return JSON.parse(storage()?.getItem(name) || 'null'); } catch { return null; } };
  const write = (name, value) => { try {
    if (value === null) storage()?.removeItem(name); else storage()?.setItem(name, JSON.stringify(value));
  } catch { /* In-memory access remains usable if storage is blocked. */ } };
  const saved = () => {
    const value = memory || read(DIRECT_KEY);
    return TOKEN.test(value?.key || '') && UUID.test(value?.userId || '') ? value : null;
  };
  const candidate = () => {
    const value = pending || read(DIRECT_PENDING_KEY);
    return TOKEN.test(value?.key || '') ? value : null;
  };
  const descriptor = value => value ? { direct: true, user: { id: value.userId, email } } : null;
  const present = () => Boolean(candidate() || saved());
  const peek = () => descriptor(saved());
  const resetRetry = () => { retryAt = 0; failures = 0; lastError = null; };

  function capture({ location = globalThis.location, history = globalThis.history } = {}) {
    if (!location?.hash) return false;
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has('lw_sync')) return false;
    const value = params.get('lw_sync');
    // Remove the secret from the visible URL before making network requests.
    params.delete('lw_sync');
    history?.replaceState?.(null, '', location.pathname + (location.search || '') + (params.size ? `#${params}` : ''));
    if (!TOKEN.test(value || '')) throw new Error('个人入口不完整，请打开原来的完整入口；本机记录未改动。');
    generation += 1;
    pending = { key: value }; write(DIRECT_PENDING_KEY, pending); resetRetry();
    return true;
  }

  async function post(route, body) {
    if (now() < retryAt && lastError) throw lastError;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000); timer?.unref?.();
    try {
      const response = await fetchImpl(`${url}/rest/v1/rpc/${route}`, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data === null) {
        const error = new Error(data?.code === '42501'
          ? '这个个人入口已停用或不正确；本机数据仍在。'
          : '云端暂时连接不上，已保留入口和本机记录，稍后自动重试。');
        error.status = response.status; throw error;
      }
      resetRetry(); return data;
    } catch (cause) {
      const error = typeof cause?.status === 'number' ? cause
        : new Error('网络暂时不可用，已保留入口和本机记录，恢复后自动同步。');
      failures += 1;
      retryAt = now() + Math.min(120000, 15000 * 2 ** Math.min(failures - 1, 3));
      lastError = error; throw error;
    } finally { clearTimeout(timer); }
  }

  async function ensure() {
    const item = candidate();
    if (!item) return peek();
    if (connection) return connection;
    const version = generation;
    connection = (async () => {
      const result = await post('listenwrite_direct_connect', { p_sync_key: item.key });
      if (version !== generation || candidate()?.key !== item.key) return peek();
      if (result?.connected !== true || !UUID.test(result.user_id || '')) {
        throw new Error('云端连接响应不完整，未替换当前入口。');
      }
      memory = { key: item.key, userId: result.user_id };
      write(DIRECT_KEY, memory); pending = null; write(DIRECT_PENDING_KEY, null);
      return peek();
    })();
    try { return await connection; } finally { connection = null; }
  }

  async function rpc(path, body = {}) {
    const route = ROUTES[path];
    if (!route) throw new Error('个人入口仅可同步学习记录。');
    const identity = await ensure(), credentials = saved();
    if (!identity || !credentials) throw new Error('此设备尚未打开个人同步入口。');
    const version = generation;
    const payload = path === 'listenwrite_push_state'
      ? { p_state: body.p_state, p_state_updated_at: body.p_state_updated_at,
          p_expected_revision: body.p_expected_revision ?? 0, p_sync_key: credentials.key }
      : { p_sync_key: credentials.key };
    const result = await post(route, payload);
    if (version !== generation || saved()?.key !== credentials.key) throw new Error('连接已改变，已忽略旧请求结果。');
    return result;
  }
  function link() { const credentials = saved(); return credentials ? `${appUrl}#lw_sync=${credentials.key}` : null; }
  function clear() {
    generation += 1; memory = null; pending = null;
    write(DIRECT_KEY, null); write(DIRECT_PENDING_KEY, null); resetRetry();
  }
  function adoptStorage() { generation += 1; memory = null; pending = null; resetRetry(); }
  return { capture, present, peek, ensure, rpc, link, clear, resetRetry, adoptStorage };
}
