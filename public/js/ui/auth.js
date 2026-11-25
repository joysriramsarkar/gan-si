/**
 * GanSiAuth: personal token stored locally, sent as Bearer on API calls.
 * Phase 4 (minimal): POST /api/users {username} -> token. No password —
 * single-device personal use; full session/OAuth deferred. The server stores
 * only a sha256 hash of the token, and accountReset revokes it server-side
 * via POST /api/users/logout before clearing local state.
 */
(function () {
  const KEY = 'gan-si-token';
  const NAME_KEY = 'gan-si-username';
  function token() { try { return localStorage.getItem(KEY); } catch { return null; } }
  function clearSession() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(NAME_KEY); } catch {}
  }
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
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      const err = new Error(body.error || 'user create failed');
      err.code = body.code;
      throw err;
    }
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
    const t = token();
    if (!t) {
      el.textContent = '🔌 স্থানীয় মোড (ব্যক্তিগত ডিভাইস)';
      return;
    }
    try {
      const r = await apiFetch('/api/users/me');
      if (!r.ok) throw new Error();
      const data = await r.json();
      el.textContent = `✅ সংযুক্ত: ${data.user.username} (id ${data.user.id})`;
      if (nameEl && !nameEl.value) nameEl.value = data.user.username;
    } catch {
      el.textContent = '⚠️ টোকেন আছে, সার্ভারে যাচাই হয়নি';
    }
  }
  window.GanSiAuth = { fetch: apiFetch, ensureUser, token, refreshMe, clearSession };
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('accountSaveBtn');
    if (btn) {
      btn.addEventListener('click', async () => {
        const name = (document.getElementById('accountName').value || 'local').trim();
        btn.textContent = '...';
        try {
          await ensureUser(name);
          btn.textContent = '✅ সংরক্ষিত';
        } catch (err) {
          btn.textContent = '❌ ব্যর্থ';
          const status = document.getElementById('accountStatus');
          if (status) status.textContent = err.code === 'USERNAME_TAKEN'
            ? '⚠️ এই নাম আগে ব্যবহৃত হয়েছে; যে token originally পেয়েছেন সেটি ব্যবহার করুন বা স্থানীয় মোডে ফিরুন।'
            : '⚠️ অ্যাকাউন্ট সংযোগ করা যায়নি; স্থানীয় মোড চালু আছে।';
        }
        refreshMe();
        setTimeout(() => { btn.textContent = 'সংরক্ষণ'; }, 1500);
      });
    }
    const resetBtn = document.getElementById('accountResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (!confirm('এই ডিভাইসের token মুছে স্থানীয় মোডে ফিরতে চান? রেকর্ডিং IndexedDB-তে থাকবে।')) return;
        // Revoke server-side first so the token dies even if a copy leaks;
        // local state is cleared either way.
        try {
          await apiFetch('/api/users/logout', { method: 'POST' });
        } catch {}
        clearSession();
        const nameEl = document.getElementById('accountName');
        if (nameEl) nameEl.value = '';
        refreshMe();
      });
    }
    refreshMe();
  });
})();
