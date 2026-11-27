/**
 * Practice analytics: dashboard aggregation + heatmap + smart suggestion.
 * Score is an aid, never the verdict of artistry. Master Plan Sec 7/8.
 */
(function (root) {
  // Day keys are the user's local calendar day, computed from the session
  // timestamp. Slicing raw ISO-UTC strings split a session across two days
  // for IST users and made "weekly" mean "the last seven days I practiced"
  // instead of the last seven calendar days.
  function dateKey(input) {
    if (input == null) return '';
    // Already a local day key: never re-parse it through UTC (which can shift
    // the day backwards in negative-offset time zones).
    const str = String(input);
    const plain = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plain) return str;
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return str.slice(0, 10);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function aggregate(sessions) {
    const byDay = {};
    let accSum = 0, accN = 0, best = null;
    const ragaCount = {}, alankarCount = {};
    for (const s of sessions) {
      const day = dateKey(s.date || s.practiced_at || '');
      byDay[day] = (byDay[day] || 0) + (s.minutes || s.duration_min || 0);
      if (s.accuracy != null) { accSum += s.accuracy; accN++; }
      if (!best || (s.minutes || 0) > (best.minutes || 0)) best = s;
      if (s.raga || s.raga_id) { const k = s.raga || s.raga_id; ragaCount[k] = (ragaCount[k] || 0) + 1; }
      if (s.alankar || s.alankar_id) { const k = s.alankar || s.alankar_id; alankarCount[k] = (alankarCount[k] || 0) + 1; }
    }
    // Calendar windows ending today (local), not "last N practiced days".
    const today = new Date();
    const sumWindow = (days) => {
      let total = 0;
      for (let i = 0; i < days; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        total += byDay[dateKey(d)] || 0;
      }
      return total;
    };
    const last7 = sumWindow(7);
    const last30 = sumWindow(30);
    return {
      daily: byDay, weeklyTotal: last7, monthlyTotal: last30,
      avgAccuracy: accN ? Math.round(accSum / accN) : null,
      bestSession: best, ragaProgress: ragaCount, alankarProgress: alankarCount
    };
  }

  // Weakest swara hint -> next practice suggestion (simple heuristic)
  function suggestNext(missBySwara) {
    const entries = Object.entries(missBySwara || {}).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return 'আজ সরল আরোহণ-অবরোহণ (৬০ BPM) দিয়ে শুরু করুন।';
    return `গত সেশনে ‘${entries[0][0]}’ স্বরে বেশি বিচ্যুতি — আজ সেই স্বরের স্থায়ী (hold) অনুশীলন করুন।`;
  }

  // Practice scoring v1: weighted aid
  function scoreSession({ pitchAcc = 0, timing = 0, holdRatio = 0, stability = 0, completion = 0 } = {}) {
    const s = 0.4 * pitchAcc + 0.2 * timing + 0.15 * holdRatio + 0.15 * stability + 0.1 * completion;
    return Math.round(Math.max(0, Math.min(100, s)));
  }

  const api = { aggregate, suggestNext, scoreSession, dateKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PracticeAnalytics = api;
})(typeof window !== 'undefined' ? window : globalThis);
