/**
 * GanSiAuth: personal token stored locally, sent as Bearer on API calls.
 * Phase 4 (minimal): POST /api/users {username} -> token. No password —
 * single-device personal use; full session/OAuth deferred.
 */
(function () {
  const KEY = 'gan-si-token';
  const NAME_KEY = 'gan-si-username';
  function token() { try { return localStorage.getItem(KEY); } catch { return null; } }
  async function apiFetch(url, opts = {}) {
    const t = token();
    const headers = { ...(opts.headers || {}) };
    if (t && String(url).startsWith('/api/')) headers.Authorization = 'Bearer ' + t;
    return fetch(url, { ...opts, headers });
  }
  async function ensureUser(username) {
    const r = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (!r.ok) throw new Error('user create failed');
    const data = await r.json();
    try {
      localStorage.setItem(KEY, data.token);
      localStorage.setItem(NAME_KEY, data.user.username);
    } catch {}
    return data;
  }
  async function refreshMe() {
    const el = document.getElementById('accountStatus');
    const nameEl = document.getElementById('accountName');
    if (!el) return;
    try {
      const r = await apiFetch('/api/me'.replace('/me', '/users/me'));
      if (!r.ok) throw new Error();
      const data = await r.json();
      el.textContent = `✅ সংযুক্ত: ${data.user.username} (id ${data.user.id})`;
      if (nameEl && !nameEl.value) nameEl.value = data.user.username;
    } catch {
      const t = token();
      el.textContent = t ? '⚠️ টোকেন আছে, সার্ভারে যাচাই হয়নি' : '🔌 স্থানীয় মোড (ব্যক্তিগত ডিভাইস)';
    }
  }
  window.GanSiAuth = { fetch: apiFetch, ensureUser, token, refreshMe };
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('accountSaveBtn');
    if (btn) {
      btn.addEventListener('click', async () => {
        const name = (document.getElementById('accountName').value || 'local').trim();
        btn.textContent = '...';
        try {
          await ensureUser(name);
          btn.textContent = '✅ সংরক্ষিত';
        } catch {
          btn.textContent = '❌ ব্যর্থ';
        }
        refreshMe();
        setTimeout(() => { btn.textContent = 'সংরক্ষণ'; }, 1500);
      });
    }
    refreshMe();
  });
})();
