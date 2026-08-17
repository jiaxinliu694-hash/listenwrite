const SUPABASE_URL = 'https://bsuilpygojnqxntrxgnm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y_nFcIW0Sg0pB2zEhMU50g_LVQMX2Am';
const APP_URL = 'https://jiaxinliu694-hash.github.io/listenwrite/';
export const OWNER_EMAIL = 'jiaxinliu694@gmail.com';

export function ownerOtpRequest() {
  return {
    url: `${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(APP_URL)}`,
    body: { email: OWNER_EMAIL, create_user: false },
  };
}

export async function sendOwnerMagicLink(fetchImpl = globalThis.fetch) {
  const { url, body } = ownerOtpRequest();
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `登录邮件发送失败 ${response.status}`);
  }
  return data;
}

function patchPrivateLoginModal() {
  const mask = document.getElementById('lwCloudMask');
  if (!mask || mask.dataset.privatePasswordless === '1') return;
  if (!mask.querySelector('#lwCloudPassword') && !mask.querySelector('#lwCloudSignup')) return;

  const panel = mask.querySelector('.lw-cloud-panel');
  const status = mask.querySelector('#lwCloudStatus');
  if (!panel || !status) return;
  mask.dataset.privatePasswordless = '1';

  mask.querySelector('.lw-cloud-grid')?.remove();
  mask.querySelector('.lw-cloud-actions')?.remove();

  const note = document.createElement('p');
  note.innerHTML = `此云端已设为私人账号：<b>${OWNER_EMAIL}</b>。无需密码，也不能注册新账号。`;
  status.before(note);

  const actions = document.createElement('div');
  actions.className = 'lw-cloud-actions';
  actions.innerHTML = '<button id="lwCloudMagicLogin" class="primary">发送登录邮件</button>';
  status.after(actions);

  document.getElementById('lwCloudMagicLogin').onclick = async () => {
    const button = document.getElementById('lwCloudMagicLogin');
    if (button) button.disabled = true;
    status.textContent = '正在发送登录邮件…';
    try {
      await sendOwnerMagicLink();
      status.textContent = '登录邮件已发送。打开 Gmail 点邮件里的登录链接即可；不会创建新账号。';
    } catch (error) {
      status.textContent = error?.message || '登录邮件发送失败';
      if (button) button.disabled = false;
    }
  };
}

export function initPrivatePasswordlessAuth() {
  if (typeof document === 'undefined') return;
  patchPrivateLoginModal();
  const observer = new MutationObserver(patchPrivateLoginModal);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  queueMicrotask(initPrivatePasswordlessAuth);
}
