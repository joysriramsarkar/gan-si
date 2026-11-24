/**
 * Practice analytics: dashboard aggregation + heatmap + smart suggestion.
 * Score is an aid, never the verdict of artistry. Master Plan Sec 7/8.
 */
(function (root) {
  function aggregate(sessions) {
    const byDay = {};
    let accSum = 0, accN = 0, best = null;
    const ragaCount = {}, alankarCount = {};
    for (const s of sessions) {
      const day = (s.date || s.practiced_at || '').slice(0, 10);
      byDay[day] = (byDay[day] || 0) + (s.minutes || s.duration_min || 0);
      if (s.accuracy != null) { accSum += s.accuracy; accN++; }
      if (!best || (s.minutes || 0) > (best.minutes || 0)) best = s;
      if (s.raga || s.raga_id) { const k = s.raga || s.raga_id; ragaCount[k] = (ragaCount[k] || 0) + 1; }
      if (s.alankar || s.alankar_id) { const k = s.alankar || s.alankar_id; alankarCount[k] = (alankarCount[k] || 0) + 1; }
    }
    const days = Object.keys(byDay).sort();
    const last7 = days.slice(-7).reduce((a, d) => a + byDay[d], 0);
    const last30 = days.slice(-30).reduce((a, d) => a + byDay[d], 0);
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

  const api = { aggregate, suggestNext, scoreSession };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PracticeAnalytics = api;
})(typeof window !== 'undefined' ? window : globalThis);
