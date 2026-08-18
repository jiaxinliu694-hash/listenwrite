const SUPABASE_URL = 'https://bsuilpygojnqxntrxgnm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y_nFcIW0Sg0pB2zEhMU50g_LVQMX2Am';
const OWNER_EMAIL = 'jiaxinliu694@gmail.com';
const SESSION_KEY = 'listenwrite-supabase-session-v1';

async function verifyOwnerOtp(code) {
  const token = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(token)) throw new Error('请输入邮件里的 6 位验证码');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, token, type: 'email' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `验证码登录失败 ${response.status}`);
  if (!data?.access_token || !data?.refresh_token) throw new Error('验证码已验证，但没有拿到登录会话');
  const expiresAt = Number(data.expires_at) || (Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600));
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, expires_at: expiresAt }));
  return data;
}

function enhanceOtpLogin() {
  const mask = document.getElementById('lwCloudMask');
  const sendButton = document.getElementById('lwCloudMagicLogin');
  if (!mask || !sendButton || document.getElementById('lwCloudOtpCode')) return;

  sendButton.textContent = '发送 6 位验证码';
  const actions = sendButton.closest('.lw-cloud-actions');
  if (!actions) return;

  const block = document.createElement('div');
  block.style.marginTop = '12px';
  block.innerHTML = `<div class="lw-cloud-field"><label for="lwCloudOtpCode">邮件验证码</label><input id="lwCloudOtpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位数字"></div><div class="lw-cloud-actions"><button id="lwCloudOtpVerify" class="primary">验证码登录</button></div><p style="margin-top:10px">不再点邮件链接。收到邮件后，把 6 位数字填在这里即可。</p>`;
  actions.insertAdjacentElement('afterend', block);

  const input = document.getElementById('lwCloudOtpCode');
  const verify = document.getElementById('lwCloudOtpVerify');
  verify.onclick = async () => {
    verify.disabled = true;
    try {
      await verifyOwnerOtp(input?.value || '');
      const status = document.getElementById('lwCloudStatus');
      if (status) status.textContent = '登录成功，正在进入云同步…';
      location.reload();
    } catch (error) {
      const status = document.getElementById('lwCloudStatus');
      if (status) status.textContent = error?.message || '验证码登录失败';
      verify.disabled = false;
    }
  };
  input?.addEventListener('keydown', event => { if (event.key === 'Enter') verify.click(); });
}

if (typeof document !== 'undefined') {
  const observer = new MutationObserver(enhanceOtpLogin);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueMicrotask(enhanceOtpLogin);
}

export { verifyOwnerOtp };
