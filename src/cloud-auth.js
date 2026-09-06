// Authentication transport only. Learning data and passwords are never persisted here.
const TERMINAL_REFRESH_CODES = new Set([
  'refresh_token_not_found', 'refresh_token_already_used',
  'session_not_found', 'session_expired', 'user_not_found', 'user_banned',
]);

export function isTerminalRefreshError(error) {
  return TERMINAL_REFRESH_CODES.has(error?.code);
}

export function authError(data = {}, status = 0, retryAfter = 0) {
  const code = String(data?.error_code || data?.code || data?.error || '');
  let message = '认证服务暂时不可用，已保留登录状态；稍后自动重试。';
  if (status === 0) message = '暂时连接不到认证服务，已保留登录状态；网络恢复后再试。';
  if (code === 'invalid_credentials') message = '同步密码不正确。这里需要听词账号的密码，不是 Gmail 或 GitHub 密码。';
  if (TERMINAL_REFRESH_CODES.has(code)) message = '这台设备的登录凭证已失效，请用同步密码重新连接；本机学习记录不受影响。';
  if (code === 'otp_expired') message = '邮件链接已失效或已使用。可改用同步密码，不必继续请求邮件。';
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    message = code === 'over_email_send_rate_limit'
      ? '邮件发送额度已用完。不要反复重发；可直接使用同步密码。'
      : '认证服务暂时限流，请稍后再试；已保留本机数据和现有登录状态。';
  }
  if (code === 'email_not_confirmed') message = '此账号尚未验证邮箱。';
  if (code === 'weak_password') message = '新密码不符合服务端要求，请使用更长且更复杂的密码。';
  if (code === 'same_password') message = '新密码与现有密码相同；可以直接在另一台设备使用这个密码。';
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid') {
    message = '服务端要求近期身份验证；请在刚刚成功登录的设备上设置密码。';
  }
  if (status >= 400 && status < 500 && !message.includes('密码') && !TERMINAL_REFRESH_CODES.has(code) && status !== 429) {
    message = `认证请求未完成（${code || status}），本机数据未改动。`;
  }
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.retryAfter = Number(retryAfter) || 0;
  return error;
}

export function createCloudAuth({ url, key, email, readSession, saveSession, clearSession,
  fetchImpl = (...args) => globalThis.fetch(...args), now = () => Date.now(),
  locks = () => globalThis.navigator?.locks,
}) {
  let refreshInFlight = null;
  let nextRefreshAt = 0;
  let refreshFailures = 0;
  let lastRefreshError = null;
  let authGeneration = 0;

  async function request(path, body, { method = 'POST', accessToken } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    timeout?.unref?.();
    let response;
    try {
      response = await fetchImpl(`${url}${path}`, {
        method,
        headers: { apikey: key, 'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const header = response.headers?.get?.('Retry-After');
        const seconds = Number(header) || Math.max(0, (Date.parse(header) - now()) / 1000) || 0;
        throw authError(data, response.status, seconds);
      }
      return data;
    } catch (error) {
      if (typeof error?.status === 'number') throw error;
      throw authError({}, 0);
    } finally { clearTimeout(timeout); }
  }

  function resetRetry() {
    nextRefreshAt = 0; refreshFailures = 0; lastRefreshError = null;
  }

  async function refresh() {
    if (refreshInFlight) return refreshInFlight;
    const initial = readSession();
    if (!initial?.refresh_token) return null;
    const generation = authGeneration;
    const task = async () => {
      // Another tab may already have rotated the token while this tab waited.
      const current = readSession();
      if (!current?.refresh_token || generation !== authGeneration) return current;
      if (current.refresh_token !== initial.refresh_token && Number(current.expires_at) * 1000 > now() + 60000) {
        resetRetry(); return current;
      }
      if (now() < nextRefreshAt && lastRefreshError) throw lastRefreshError;
      const token = current.refresh_token;
      try {
        const data = await request('/auth/v1/token?grant_type=refresh_token', { refresh_token: token });
        const latest = readSession();
        if (generation !== authGeneration || !latest || latest.refresh_token !== token) return latest;
        if (!data?.access_token || !data?.refresh_token) throw authError({}, 502);
        resetRetry();
        return saveSession(data);
      } catch (error) {
        const latest = readSession();
        if (generation !== authGeneration || !latest || latest.refresh_token !== token) return latest;
        if (isTerminalRefreshError(error)) {
          clearSession(); resetRetry();
        } else {
          // A timeout, 429, malformed response or server failure is NOT logout.
          refreshFailures += 1;
          const delay = Math.max(Number(error.retryAfter || 0) * 1000,
            Math.min(120000, 15000 * 2 ** Math.min(refreshFailures - 1, 3)));
          nextRefreshAt = now() + delay;
          lastRefreshError = error;
        }
        throw error;
      }
    };
    refreshInFlight = (async () => {
      const manager = locks();
      return manager?.request ? manager.request('listenwrite-auth-refresh-v1', task) : task();
    })();
    try { return await refreshInFlight; }
    finally { refreshInFlight = null; }
  }

  async function ensure() {
    const current = readSession();
    if (!current) return null;
    if (Number(current.expires_at || 0) * 1000 <= now() + 60000) return refresh();
    return current;
  }

  async function signIn(password) {
    if (typeof password !== 'string' || !password.length) throw new Error('请输入同步密码。');
    // Do not trim passwords or fall back to sending mail after a failed login.
    const data = await request('/auth/v1/token?grant_type=password', { email, password });
    if (!data?.access_token || !data?.refresh_token || !data?.user?.id
      || String(data.user.email || '').toLowerCase() !== email.toLowerCase()) {
      throw new Error('认证响应不完整或账号不匹配，未替换当前登录状态。');
    }
    authGeneration += 1;
    resetRetry();
    return saveSession(data);
  }

  async function setPassword(password) {
    if (typeof password !== 'string' || password.length < 8) throw new Error('同步密码至少需要 8 个字符。');
    const current = await ensure();
    if (!current?.access_token || String(current.user?.email || '').toLowerCase() !== email.toLowerCase()) {
      throw new Error('只能在已登录本人账号的设备上设置同步密码。');
    }
    const user = await request('/auth/v1/user', { password }, { method: 'PUT', accessToken: current.access_token });
    if (user?.id !== current.user.id) throw new Error('密码更新返回的账号不匹配。');
    return true;
  }

  function invalidatePending() { authGeneration += 1; resetRetry(); }
  return { ensure, refresh, signIn, setPassword, request, resetRetry, invalidatePending };
}
