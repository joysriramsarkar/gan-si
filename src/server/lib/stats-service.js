/**
 * Streak + aggregation, IST (Asia/Kolkata) day boundary.
 * Master Plan Sec 4.3
 */
function istDateStr(d = new Date(), tz = 'Asia/Kolkata') {
  try {
    // en-CA gives YYYY-MM-DD
    return new Date(d).toLocaleDateString('en-CA', { timeZone: tz });
  } catch {
    return new Date(d).toISOString().split('T')[0];
  }
}

function computeStreak(dayStrings, todayStr) {
  // dayStrings: sorted unique 'YYYY-MM-DD' desc or asc; returns current streak ending today/yesterday
  const set = new Set(dayStrings);
  let streak = 0;
  let cursor = todayStr;
  if (!set.has(cursor)) {
    // allow streak to survive if last practiced yesterday
    const y = new Date(cursor + 'T12:00:00Z');
    y.setUTCDate(y.getUTCDate() - 1);
    const yStr = y.toISOString().split('T')[0];
    if (!set.has(yStr)) return 0;
    cursor = yStr;
  }
  while (set.has(cursor)) {
    streak++;
    const d = new Date(cursor + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().split('T')[0];
  }
  return streak;
}

function summarizeSessions(rows, tz) {
  const totalMinutes = rows.reduce((a, r) => a + (r.duration_min || 0), 0);
  const totalSessions = rows.length;
  const days = [...new Set(rows.map(r => istDateStr(new Date(r.practiced_at), tz)))].sort();
  const todayStr = istDateStr(new Date(), tz);
  const currentStreak = computeStreak(days, todayStr);
  const lastPracticedDate = days.length ? days[days.length - 1] : null;
  const history = rows.slice(0, 50).map(r => ({
    date: r.practiced_at,
    minutes: r.duration_min,
    accuracy: r.accuracy,
    raga: r.raga_id,
    alankar: r.alankar_id
  }));
  return { totalMinutes, totalSessions, currentStreak, lastPracticedDate, history };
}

function validateSession(body) {
  const errors = [];
  const minutes = parseInt(body.minutes ?? body.duration ?? body.duration_min ?? NaN, 10);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) errors.push('minutes must be 1..180');
  let accuracy = body.accuracy;
  if (accuracy === undefined || accuracy === null || accuracy === '') accuracy = null;
  else {
    accuracy = parseInt(accuracy, 10);
    if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) errors.push('accuracy must be 0..100');
  }
  const raga_id = body.raga_id ?? body.raga ?? null;
  const alankarRaw = body.alankar_id ?? body.alankar ?? null;
  const alankar_id = alankarRaw == null ? null : String(alankarRaw).slice(0, 60);
  return { errors, value: { minutes, accuracy, raga_id: raga_id ? String(raga_id).slice(0, 60) : null, alankar_id } };
}

module.exports = { istDateStr, computeStreak, summarizeSessions, validateSession };
