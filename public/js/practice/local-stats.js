/**
 * Local-first practice stats for static / offline builds (Vercel, APK).
 * The full backend keeps its SQLite stats; when no server exists this module
 * stores daily minutes in localStorage so streaks, totals and the progress
 * calendar still work on the device. Nothing leaves the browser.
 */
(function (root) {
  const KEY = 'gan-si-local-stats-v1';

  function dateKey(d) {
    const x = d instanceof Date ? d : new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return raw && typeof raw === 'object' && raw.days ? raw : { days: {} };
    } catch (_) {
      return { days: {} };
    }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* private mode */ }
  }

  function summary(state) {
    const s = state || load();
    const days = s.days || {};
    const keys = Object.keys(days).sort();
    const totalMinutes = keys.reduce((sum, k) => sum + (Number(days[k]) || 0), 0);

    // Streak: consecutive practised days ending today; if today is still
    // empty, a streak ending yesterday is still "current" until midnight.
    const cursor = new Date();
    if (!(Number(days[dateKey(cursor)]) > 0)) cursor.setDate(cursor.getDate() - 1);
    let currentStreak = 0;
    while (Number(days[dateKey(cursor)]) > 0) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const sumLastDays = (n) => {
      let total = 0;
      const d = new Date();
      for (let i = 0; i < n; i++) {
        total += Number(days[dateKey(d)]) || 0;
        d.setDate(d.getDate() - 1);
      }
      return total;
    };

    return {
      totalMinutes,
      currentStreak,
      weekMinutes: sumLastDays(7),
      monthMinutes: sumLastDays(30),
      history: keys.slice(-183).map((k) => ({ date: k, minutes: Number(days[k]) || 0 }))
    };
  }

  /** Add practised minutes to today and return the fresh summary. */
  function addMinutes(minutes) {
    const n = Math.max(1, Math.round(Number(minutes) || 1));
    const s = load();
    const k = dateKey(new Date());
    s.days[k] = (Number(s.days[k]) || 0) + n;
    save(s);
    return summary(s);
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (_) {}
  }

  const api = { load, summary, addMinutes, dateKey, reset, KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GanSiLocalStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
